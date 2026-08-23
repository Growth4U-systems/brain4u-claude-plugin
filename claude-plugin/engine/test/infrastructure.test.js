import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { applyInfrastructure, planInfrastructure } from '../src/infrastructure.js';

const PUBLIC_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestKey brain4u-test';

async function infrastructureConfig(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-infra-test-'));
  const publicKeyFile = path.join(root, 'id_ed25519.pub');
  await writeFile(publicKeyFile, `${PUBLIC_KEY}\n`);
  return {
    installationId: 'brain4u-test',
    infrastructure: {
      kind: 'hetzner',
      tokenEnv: 'HCLOUD_TOKEN',
      serverName: 'brain4u-client-test',
      serverType: 'cx23',
      location: 'nbg1',
      image: 'ubuntu-24.04',
      sshPublicKeyFile: publicKeyFile,
      sshAllowedCidr: '192.0.2.44/32',
      maxMonthlyGross: '6.00',
      currency: 'EUR',
      publicIpv4: true,
      publicIpv6: true,
      deleteProtection: true,
      rebuildProtection: true,
      firewallName: 'brain4u-test-ssh',
      sshKeyName: 'brain4u-test-ssh',
      ...overrides,
    },
  };
}

function catalog() {
  return {
    servers: [],
    sshKeys: [],
    firewalls: [],
    serverTypes: [{
      id: 114,
      name: 'cx23',
      prices: [{
        location: 'nbg1',
        price_hourly: { gross: '0.0088000000000000' },
        price_monthly: { gross: '5.4900000000000000' },
      }],
    }],
    locations: [{ id: 2, name: 'nbg1' }],
    images: [{ id: 161547269, name: 'ubuntu-24.04' }],
  };
}

function mockClient(data, posts = []) {
  return {
    async listAll(resource) {
      if (resource === '/servers') return data.servers;
      if (resource === '/server_types') return data.serverTypes;
      if (resource === '/locations') return data.locations;
      if (resource === '/images') return data.images;
      if (resource === '/ssh_keys') return data.sshKeys;
      if (resource === '/firewalls') return data.firewalls;
      throw new Error(`Unexpected resource ${resource}`);
    },
    async get(resource) {
      if (resource === '/pricing') return { pricing: {
        currency: 'EUR',
        primary_ips: [{
          type: 'ipv4',
          prices: [{
            location: 'nbg1',
            price_hourly: { gross: '0.0008000000000000' },
            price_monthly: { gross: '0.5000000000000000' },
          }],
        }],
      } };
      throw new Error(`Unexpected GET ${resource}`);
    },
    async post(resource, body) {
      posts.push({ resource, body });
      if (resource === '/ssh_keys') {
        const key = { id: 10, name: body.name, public_key: body.public_key, fingerprint: 'aa:bb', labels: body.labels };
        data.sshKeys.push(key);
        return { ssh_key: key };
      }
      if (resource === '/firewalls') {
        const firewall = { id: 20, name: body.name, labels: body.labels, rules: body.rules };
        data.firewalls.push(firewall);
        return { firewall };
      }
      if (resource === '/servers') {
        const server = {
          id: 30,
          name: body.name,
          status: 'running',
          labels: body.labels,
          server_type: { name: body.server_type },
          image: { name: body.image },
          location: { name: body.location },
          public_net: { ipv4: { ip: '192.0.2.80' }, firewalls: [{ firewall: { id: body.firewalls[0].firewall }, status: 'applied' }] },
          protection: { delete: false, rebuild: false },
        };
        data.servers.push(server);
        return { server, action: { id: 40 } };
      }
      if (resource === '/servers/30/actions/change_protection') {
        data.servers[0].protection = { delete: body.delete, rebuild: body.rebuild };
        return { action: { id: 41 } };
      }
      if (resource === '/firewalls/20/actions/apply_to_resources') {
        data.servers[0].public_net.firewalls = [{ firewall: { id: 20 }, status: 'applied' }];
        return { actions: [{ id: 42 }] };
      }
      throw new Error(`Unexpected POST ${resource}`);
    },
    async waitForAction() {},
  };
}

test('plans live-priced Hetzner resources without mutations', async () => {
  const config = await infrastructureConfig();
  const data = catalog();
  const posts = [];
  const plan = await planInfrastructure({ config, client: mockClient(data, posts) });

  assert.deepEqual(plan.actions, ['create_ssh_key', 'create_firewall', 'create_server']);
  assert.equal(plan.desired.serverMonthlyGross, '5.49');
  assert.equal(plan.desired.primaryIpv4MonthlyGross, '0.5');
  assert.equal(plan.desired.priceMonthlyGross, '5.99');
  assert.equal(plan.desired.currency, 'EUR');
  assert.match(plan.approvalCode, /^[a-f0-9]{16}$/);
  assert.equal(plan.mutationsPerformed, false);
  assert.equal(posts.length, 0);
});

test('refuses mutations without the exact approval code', async () => {
  const config = await infrastructureConfig();
  const data = catalog();
  const posts = [];
  await assert.rejects(
    applyInfrastructure({ config, client: mockClient(data, posts), approval: 'wrong-code' }),
    /Infrastructure approval is required/,
  );
  assert.equal(posts.length, 0);
});

test('creates explicit network, firewall and protected owned resources once', async () => {
  const config = await infrastructureConfig();
  const data = catalog();
  const posts = [];
  const client = mockClient(data, posts);
  const plan = await planInfrastructure({ config, client });
  const result = await applyInfrastructure({ config, client, approval: plan.approvalCode });

  assert.equal(result.actions.length, 0);
  assert.equal(result.resolvedHost, '192.0.2.80');
  const serverCreate = posts.find((call) => call.resource === '/servers');
  assert.deepEqual(serverCreate.body.public_net, { enable_ipv4: true, enable_ipv6: true });
  assert.deepEqual(serverCreate.body.firewalls, [{ firewall: 20 }]);
  assert.deepEqual(serverCreate.body.ssh_keys, [10]);
  assert.equal(serverCreate.body.labels['brain4u-installation'], 'brain4u-test');
  assert.equal(data.servers[0].protection.delete, true);
  assert.equal(data.servers[0].protection.rebuild, true);

  const postCount = posts.length;
  const second = await applyInfrastructure({ config, client, approval: null });
  assert.equal(second.mutationsPerformed, false);
  assert.equal(posts.length, postCount);
});

test('accepts the current Hetzner server location field', async () => {
  const config = await infrastructureConfig();
  const data = catalog();
  data.sshKeys.push({ id: 10, name: 'existing-key', public_key: PUBLIC_KEY, fingerprint: 'aa:bb' });
  data.firewalls.push({
    id: 20,
    name: 'brain4u-test-ssh',
    labels: { 'brain4u-installation': 'brain4u-test', 'managed-by': 'brain4u-installer' },
    rules: [{ direction: 'in', protocol: 'tcp', port: '22', source_ips: ['192.0.2.44/32'] }],
  });
  data.servers.push({
    id: 30,
    name: 'brain4u-client-test',
    status: 'running',
    labels: { 'brain4u-installation': 'brain4u-test', 'managed-by': 'brain4u-installer' },
    server_type: { name: 'cx23' },
    image: { name: 'ubuntu-24.04' },
    location: { name: 'nbg1' },
    public_net: { ipv4: { ip: '192.0.2.80' }, firewalls: [{ firewall: { id: 20 }, status: 'applied' }] },
    protection: { delete: true, rebuild: true },
  });

  const plan = await planInfrastructure({ config, client: mockClient(data) });
  assert.deepEqual(plan.actions, []);
  assert.equal(plan.existing.server.location, 'nbg1');
});

test('refuses to adopt a same-name server owned outside this installation', async () => {
  const config = await infrastructureConfig();
  const data = catalog();
  data.servers.push({
    id: 99,
    name: 'brain4u-client-test',
    labels: {},
    server_type: { name: 'cx23' },
    image: { name: 'ubuntu-24.04' },
    datacenter: { location: { name: 'nbg1' } },
    public_net: { ipv4: { ip: '192.0.2.90' } },
    protection: { delete: true, rebuild: true },
  });

  await assert.rejects(planInfrastructure({ config, client: mockClient(data) }), /is not owned/);
});

test('blocks a live price above the configured ceiling', async () => {
  const config = await infrastructureConfig({ maxMonthlyGross: '5.48' });
  await assert.rejects(
    planInfrastructure({ config, client: mockClient(catalog()) }),
    /exceeds configured monthly limit/,
  );
});

test('blocks an owned firewall whose SSH rule drifted broader', async () => {
  const config = await infrastructureConfig();
  const data = catalog();
  data.firewalls.push({
    id: 20,
    name: 'brain4u-test-ssh',
    labels: { 'brain4u-installation': 'brain4u-test', 'managed-by': 'brain4u-installer' },
    rules: [{ direction: 'in', protocol: 'tcp', port: '22', source_ips: ['0.0.0.0/0'] }],
  });

  await assert.rejects(
    planInfrastructure({ config, client: mockClient(data) }),
    /unsupported rule drift/,
  );
});

test('reattaches an owned firewall after an interrupted server flow', async () => {
  const config = await infrastructureConfig();
  const data = catalog();
  data.sshKeys.push({ id: 10, name: 'existing-key', public_key: PUBLIC_KEY, fingerprint: 'aa:bb' });
  data.firewalls.push({
    id: 20,
    name: 'brain4u-test-ssh',
    labels: { 'brain4u-installation': 'brain4u-test', 'managed-by': 'brain4u-installer' },
    rules: [{ direction: 'in', protocol: 'tcp', port: '22', source_ips: ['192.0.2.44/32'] }],
  });
  data.servers.push({
    id: 30,
    name: 'brain4u-client-test',
    status: 'running',
    labels: { 'brain4u-installation': 'brain4u-test', 'managed-by': 'brain4u-installer' },
    server_type: { name: 'cx23' },
    image: { name: 'ubuntu-24.04' },
    datacenter: { location: { name: 'nbg1' } },
    public_net: { ipv4: { ip: '192.0.2.80' }, firewalls: [] },
    protection: { delete: true, rebuild: true },
  });
  const posts = [];
  const client = mockClient(data, posts);
  const plan = await planInfrastructure({ config, client });
  assert.deepEqual(plan.actions, ['attach_firewall']);

  const result = await applyInfrastructure({ config, client, approval: plan.approvalCode });
  assert.equal(result.actions.length, 0);
  assert.equal(posts.filter((call) => call.resource === '/firewalls/20/actions/apply_to_resources').length, 1);
});
