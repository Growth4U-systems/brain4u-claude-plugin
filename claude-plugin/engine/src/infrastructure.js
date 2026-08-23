import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { HetznerClient } from './hetzner-client.js';
import { addMoney, assertWithinLimit, normalizeMoney } from './money.js';

const OWNER_LABEL = 'brain4u-installation';
const MANAGED_LABEL = 'managed-by';
const MANAGED_VALUE = 'brain4u-installer';

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const fields = Object.keys(value).sort();
    return `{${fields.map((field) => `${JSON.stringify(field)}:${stableStringify(value[field])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function approvalCode(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 16);
}

function oneByName(items, name, kind) {
  const matches = items.filter((item) => item.name === name);
  if (matches.length !== 1) throw new Error(`Expected exactly one Hetzner ${kind} named ${name}, found ${matches.length}`);
  return matches[0];
}

function assertOwned(resource, config, kind) {
  if (resource.labels?.[OWNER_LABEL] !== config.installationId || resource.labels?.[MANAGED_LABEL] !== MANAGED_VALUE) {
    throw new Error(`Hetzner ${kind} ${resource.name} already exists but is not owned by installation ${config.installationId}`);
  }
}

function primaryIpv4(server) {
  return server?.public_net?.ipv4?.ip ?? null;
}

function serverLocation(server) {
  return server.location?.name ?? server.datacenter?.location?.name ?? null;
}

function serverSummary(server) {
  return {
    id: server.id,
    name: server.name,
    status: server.status,
    ipv4: primaryIpv4(server),
    serverType: server.server_type?.name,
    location: serverLocation(server),
    deleteProtection: Boolean(server.protection?.delete),
    rebuildProtection: Boolean(server.protection?.rebuild),
    firewallIds: (server.public_net?.firewalls ?? []).map((entry) => entry.firewall?.id ?? entry.id),
  };
}

function firewallHasExpectedRule(firewall, config) {
  const rules = firewall.rules ?? [];
  if (rules.length !== 1) return false;
  const rule = rules[0];
  return rule.direction === 'in'
    && rule.protocol === 'tcp'
    && String(rule.port) === '22'
    && Array.isArray(rule.source_ips)
    && rule.source_ips.length === 1
    && rule.source_ips[0] === config.infrastructure.sshAllowedCidr
    && (!rule.destination_ips || rule.destination_ips.length === 0);
}

function serverHasFirewall(server, firewallId) {
  return (server?.public_net?.firewalls ?? server?.firewallIds?.map((id) => ({ id })) ?? [])
    .some((entry) => (entry.firewall?.id ?? entry.id) === firewallId);
}

async function loadPublicKey(config) {
  return (await readFile(config.infrastructure.sshPublicKeyFile, 'utf8')).trim();
}

function samePublicKey(left, right) {
  return left.trim().split(/\s+/).slice(0, 2).join(' ') === right.trim().split(/\s+/).slice(0, 2).join(' ');
}

export function buildHetznerClient(config, options = {}) {
  const token = process.env[config.infrastructure.tokenEnv];
  return new HetznerClient({ token, fetchImpl: options.fetchImpl, endpoint: options.endpoint });
}

export async function planInfrastructure({ config, client = buildHetznerClient(config) }) {
  const infrastructure = config.infrastructure;
  const [servers, serverTypes, locations, images, sshKeys, firewalls, pricingResponse, publicKey] = await Promise.all([
    client.listAll('/servers', 'servers', { name: infrastructure.serverName }),
    client.listAll('/server_types', 'server_types', { name: infrastructure.serverType }),
    client.listAll('/locations', 'locations', { name: infrastructure.location }),
    client.listAll('/images', 'images', { name: infrastructure.image, architecture: 'x86', type: 'system' }),
    client.listAll('/ssh_keys', 'ssh_keys'),
    client.listAll('/firewalls', 'firewalls', { name: infrastructure.firewallName }),
    client.get('/pricing'),
    loadPublicKey(config),
  ]);

  const serverType = oneByName(serverTypes, infrastructure.serverType, 'server type');
  const location = oneByName(locations, infrastructure.location, 'location');
  const image = oneByName(images, infrastructure.image, 'image');
  const price = serverType.prices?.find((candidate) => candidate.location === infrastructure.location);
  if (!price?.price_monthly?.gross || !price?.price_hourly?.gross) {
    throw new Error(`No Hetzner price found for ${infrastructure.serverType} in ${infrastructure.location}`);
  }
  const accountCurrency = pricingResponse.pricing?.currency;
  if (accountCurrency !== infrastructure.currency) {
    throw new Error(`Hetzner project currency ${accountCurrency ?? 'unknown'} does not match configured currency ${infrastructure.currency}`);
  }
  const ipv4Price = infrastructure.publicIpv4
    ? pricingResponse.pricing?.primary_ips
      ?.find((candidate) => candidate.type === 'ipv4')
      ?.prices?.find((candidate) => candidate.location === infrastructure.location)
    : null;
  if (infrastructure.publicIpv4 && (!ipv4Price?.price_monthly?.gross || !ipv4Price?.price_hourly?.gross)) {
    throw new Error(`No Hetzner Primary IPv4 price found in ${infrastructure.location}`);
  }
  const serverMonthlyGross = normalizeMoney(price.price_monthly.gross);
  const serverHourlyGross = normalizeMoney(price.price_hourly.gross);
  const ipv4MonthlyGross = ipv4Price ? normalizeMoney(ipv4Price.price_monthly.gross) : '0';
  const ipv4HourlyGross = ipv4Price ? normalizeMoney(ipv4Price.price_hourly.gross) : '0';
  const totalMonthlyGross = addMoney(serverMonthlyGross, ipv4MonthlyGross);
  const totalHourlyGross = addMoney(serverHourlyGross, ipv4HourlyGross);
  assertWithinLimit(totalMonthlyGross, infrastructure.maxMonthlyGross, 'total monthly price');

  const matchingSshKeys = sshKeys.filter((key) => samePublicKey(key.public_key, publicKey));
  if (matchingSshKeys.length > 1) throw new Error('The local SSH public key matches more than one Hetzner key');
  const sshKey = matchingSshKeys[0] ?? null;

  if (firewalls.length > 1) throw new Error(`More than one Hetzner firewall is named ${infrastructure.firewallName}`);
  const firewall = firewalls[0] ?? null;
  if (firewall) {
    assertOwned(firewall, config, 'firewall');
    if (!firewallHasExpectedRule(firewall, config)) {
      throw new Error(`Owned Hetzner firewall ${firewall.name} has unsupported rule drift`);
    }
  }

  if (servers.length > 1) throw new Error(`More than one Hetzner server is named ${infrastructure.serverName}`);
  const server = servers[0] ?? null;
  if (server) {
    assertOwned(server, config, 'server');
    const drift = [];
    if (server.server_type?.name !== infrastructure.serverType) drift.push('server_type');
    if (serverLocation(server) !== infrastructure.location) drift.push('location');
    if (server.image?.name && server.image.name !== infrastructure.image) drift.push('image');
    if (!primaryIpv4(server)) drift.push('public_ipv4');
    if (drift.length) throw new Error(`Owned Hetzner server has unsupported drift: ${drift.join(', ')}`);
  }

  const actions = [];
  if (!sshKey) actions.push('create_ssh_key');
  if (!firewall) actions.push('create_firewall');
  if (!server) actions.push('create_server');
  if (server && (!firewall || !serverHasFirewall(server, firewall.id))) actions.push('attach_firewall');
  if (server && (!server.protection?.delete || !server.protection?.rebuild)) actions.push('enable_server_protection');

  const desired = {
    installationId: config.installationId,
    serverName: infrastructure.serverName,
    serverType: infrastructure.serverType,
    location: infrastructure.location,
    image: infrastructure.image,
    publicIpv4: infrastructure.publicIpv4,
    publicIpv6: infrastructure.publicIpv6,
    sshAllowedCidr: infrastructure.sshAllowedCidr,
    firewallName: infrastructure.firewallName,
    deleteProtection: infrastructure.deleteProtection,
    rebuildProtection: infrastructure.rebuildProtection,
    serverMonthlyGross,
    serverHourlyGross,
    primaryIpv4MonthlyGross: ipv4MonthlyGross,
    primaryIpv4HourlyGross: ipv4HourlyGross,
    priceMonthlyGross: totalMonthlyGross,
    priceHourlyGross: totalHourlyGross,
    maxMonthlyGross: normalizeMoney(infrastructure.maxMonthlyGross),
    currency: infrastructure.currency,
    serverTypeId: serverType.id,
    locationId: location.id,
    imageId: image.id,
  };
  const approval = actions.length ? approvalCode({ desired, actions }) : null;

  return {
    provider: 'hetzner',
    mutationsPerformed: false,
    tokenAvailableLocally: Boolean(process.env[infrastructure.tokenEnv]),
    desired,
    actions,
    approvalCode: approval,
    requiresApproval: actions.length > 0,
    existing: {
      server: server ? serverSummary(server) : null,
      sshKey: sshKey ? { id: sshKey.id, name: sshKey.name, fingerprint: sshKey.fingerprint } : null,
      firewall: firewall ? { id: firewall.id, name: firewall.name } : null,
    },
    resolvedHost: server ? primaryIpv4(server) : null,
  };
}

async function createSshKey(client, config) {
  const publicKey = await loadPublicKey(config);
  const response = await client.post('/ssh_keys', {
    name: config.infrastructure.sshKeyName,
    public_key: publicKey,
    labels: {
      [OWNER_LABEL]: config.installationId,
      [MANAGED_LABEL]: MANAGED_VALUE,
    },
  });
  return response.ssh_key;
}

async function createFirewall(client, config) {
  const response = await client.post('/firewalls', {
    name: config.infrastructure.firewallName,
    labels: {
      [OWNER_LABEL]: config.installationId,
      [MANAGED_LABEL]: MANAGED_VALUE,
    },
    rules: [{
      direction: 'in',
      protocol: 'tcp',
      port: '22',
      source_ips: [config.infrastructure.sshAllowedCidr],
      description: 'Brain4U installer SSH access',
    }],
  });
  return response.firewall;
}

async function createServer(client, config, sshKey, firewall) {
  const infrastructure = config.infrastructure;
  const response = await client.post('/servers', {
    name: infrastructure.serverName,
    server_type: infrastructure.serverType,
    image: infrastructure.image,
    location: infrastructure.location,
    ssh_keys: [sshKey.id],
    firewalls: [{ firewall: firewall.id }],
    public_net: {
      enable_ipv4: infrastructure.publicIpv4,
      enable_ipv6: infrastructure.publicIpv6,
    },
    labels: {
      [OWNER_LABEL]: config.installationId,
      [MANAGED_LABEL]: MANAGED_VALUE,
    },
    start_after_create: true,
  });
  if (response.action?.id) await client.waitForAction(response.action.id);
  for (const action of response.next_actions ?? []) {
    if (action.id) await client.waitForAction(action.id);
  }
  return response.server;
}

async function attachFirewall(client, firewall, server) {
  const response = await client.post(`/firewalls/${firewall.id}/actions/apply_to_resources`, {
    apply_to: [{ type: 'server', server: { id: server.id } }],
  });
  for (const action of response.actions ?? []) {
    if (action.id) await client.waitForAction(action.id);
  }
}

async function protectServer(client, server, config) {
  const response = await client.post(`/servers/${server.id}/actions/change_protection`, {
    delete: config.infrastructure.deleteProtection,
    rebuild: config.infrastructure.rebuildProtection,
  });
  if (response.action?.id) await client.waitForAction(response.action.id);
}

export async function applyInfrastructure({ config, approval, client = buildHetznerClient(config), onEvent = () => {} }) {
  const before = await planInfrastructure({ config, client });
  if (before.requiresApproval && approval !== before.approvalCode) {
    throw new Error(`Infrastructure approval is required. Run plan and pass --approve-infrastructure ${before.approvalCode}`);
  }
  if (!before.requiresApproval) return { ...before, mutationsPerformed: false };

  let sshKey = before.existing.sshKey;
  if (!sshKey) {
    onEvent({ type: 'infrastructure_started', action: 'create_ssh_key' });
    sshKey = await createSshKey(client, config);
    onEvent({ type: 'infrastructure_completed', action: 'create_ssh_key' });
  }

  let firewall = before.existing.firewall;
  if (!firewall) {
    onEvent({ type: 'infrastructure_started', action: 'create_firewall' });
    firewall = await createFirewall(client, config);
    onEvent({ type: 'infrastructure_completed', action: 'create_firewall' });
  }

  let server = before.existing.server;
  const serverExistedBeforeApply = Boolean(server);
  if (!server) {
    onEvent({ type: 'infrastructure_started', action: 'create_server' });
    server = await createServer(client, config, sshKey, firewall);
    onEvent({ type: 'infrastructure_completed', action: 'create_server' });
  }

  if (serverExistedBeforeApply && !serverHasFirewall(server, firewall.id)) {
    onEvent({ type: 'infrastructure_started', action: 'attach_firewall' });
    await attachFirewall(client, firewall, server);
    onEvent({ type: 'infrastructure_completed', action: 'attach_firewall' });
  }

  if (!server.deleteProtection || !server.rebuildProtection) {
    onEvent({ type: 'infrastructure_started', action: 'enable_server_protection' });
    await protectServer(client, server, config);
    onEvent({ type: 'infrastructure_completed', action: 'enable_server_protection' });
  }

  const after = await planInfrastructure({ config, client });
  if (after.actions.length) throw new Error(`Infrastructure postcondition failed: ${after.actions.join(', ')}`);
  return { ...after, mutationsPerformed: true };
}

export function withResolvedTarget(config, host) {
  if (!host) throw new Error('Hetzner infrastructure has no resolved public IPv4 address');
  return { ...config, target: { ...config.target, host } };
}
