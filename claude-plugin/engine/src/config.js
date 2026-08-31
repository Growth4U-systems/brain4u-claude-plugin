import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parseMoney } from './money.js';

const ALLOWED_SECRET_REFERENCE_FIELDS = new Set(['keyEnv', 'tokenEnv', 'deployKeyFile']);
const SUSPICIOUS_FIELD = /(secret|password|token|api.?key|credential)/i;
const SAFE_IDENTIFIER = /^[a-z0-9][a-z0-9-]{2,62}$/;
const SAFE_REMOTE_VALUE = /^[A-Za-z0-9._:/@+-]+$/;
const PINNED_IMAGE = /^nousresearch\/hermes-agent@sha256:[a-f0-9]{64}$/;
const SAFE_REPOSITORY_NAME = /^[A-Za-z0-9._-]{1,100}$/;

export function expandHome(value) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function assertNoInlineSecrets(value, location = 'config') {
  if (!value || typeof value !== 'object') return;

  for (const [field, child] of Object.entries(value)) {
    if (SUSPICIOUS_FIELD.test(field) && !ALLOWED_SECRET_REFERENCE_FIELDS.has(field)) {
      throw new Error(`Inline secret field is forbidden: ${location}.${field}`);
    }
    assertNoInlineSecrets(child, `${location}.${field}`);
  }
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

export function validateConfig(raw) {
  assertNoInlineSecrets(raw);

  if (raw?.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  if (!SAFE_IDENTIFIER.test(requiredString(raw.installationId, 'installationId'))) {
    throw new Error('installationId must contain lowercase letters, numbers and hyphens');
  }

  const hasManagedInfrastructure = raw.infrastructure?.kind === 'hetzner';
  const host = raw.target?.host == null && hasManagedInfrastructure
    ? null
    : requiredString(raw.target?.host, 'target.host');
  const user = requiredString(raw.target?.user, 'target.user');
  const identityFile = expandHome(requiredString(raw.target?.identityFile, 'target.identityFile'));
  if ((host && !SAFE_REMOTE_VALUE.test(host)) || !SAFE_REMOTE_VALUE.test(user)) {
    throw new Error('target host or user contains unsupported characters');
  }

  const strictHostKeyChecking = raw.target?.strictHostKeyChecking ?? 'accept-new';
  if (!['yes', 'accept-new'].includes(strictHostKeyChecking)) {
    throw new Error('target.strictHostKeyChecking must be yes or accept-new');
  }
  const userKnownHostsFile = raw.target?.userKnownHostsFile
    ? expandHome(requiredString(raw.target.userKnownHostsFile, 'target.userKnownHostsFile'))
    : null;

  const image = requiredString(raw.hermes?.image, 'hermes.image');
  if (!PINNED_IMAGE.test(image)) {
    throw new Error('hermes.image must pin the official image by sha256 digest');
  }

  if (raw.provider?.kind !== 'openrouter') {
    throw new Error('This version currently supports provider.kind=openrouter only');
  }
  const model = requiredString(raw.provider?.model, 'provider.model');
  const keyEnv = requiredString(raw.provider?.keyEnv, 'provider.keyEnv');
  if (!SAFE_REMOTE_VALUE.test(model) || !/^[A-Z][A-Z0-9_]+$/.test(keyEnv)) {
    throw new Error('provider model or keyEnv contains unsupported characters');
  }

  let infrastructure;
  if (raw.infrastructure !== undefined) {
    if (raw.infrastructure?.kind !== 'hetzner') {
      throw new Error('infrastructure.kind must be hetzner');
    }
    const serverName = requiredString(raw.infrastructure.serverName, 'infrastructure.serverName');
    const serverType = requiredString(raw.infrastructure.serverType, 'infrastructure.serverType');
    const location = requiredString(raw.infrastructure.location, 'infrastructure.location');
    const infrastructureImage = requiredString(raw.infrastructure.image, 'infrastructure.image');
    const tokenEnv = requiredString(raw.infrastructure.tokenEnv, 'infrastructure.tokenEnv');
    const sshPublicKeyFile = expandHome(requiredString(raw.infrastructure.sshPublicKeyFile, 'infrastructure.sshPublicKeyFile'));
    const sshAllowedCidr = requiredString(raw.infrastructure.sshAllowedCidr, 'infrastructure.sshAllowedCidr');
    const maxMonthlyGross = requiredString(raw.infrastructure.maxMonthlyGross, 'infrastructure.maxMonthlyGross');
    const currency = requiredString(raw.infrastructure.currency, 'infrastructure.currency');
    const firewallName = raw.infrastructure.firewallName
      ?? `${raw.installationId}-ssh`;
    const sshKeyName = raw.infrastructure.sshKeyName
      ?? `${raw.installationId}-ssh`;

    for (const [field, value] of Object.entries({ serverName, serverType, location, infrastructureImage, firewallName, sshKeyName })) {
      if (!SAFE_REMOTE_VALUE.test(value)) throw new Error(`infrastructure.${field} contains unsupported characters`);
    }
    if (!/^[A-Z][A-Z0-9_]+$/.test(tokenEnv)) {
      throw new Error('infrastructure.tokenEnv must be an uppercase environment variable name');
    }
    if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}\/32$/.test(sshAllowedCidr)) {
      throw new Error('infrastructure.sshAllowedCidr must be a single IPv4 /32 address');
    }
    for (const octet of sshAllowedCidr.split('/')[0].split('.').map(Number)) {
      if (octet > 255) throw new Error('infrastructure.sshAllowedCidr contains an invalid IPv4 address');
    }
    parseMoney(maxMonthlyGross, 'infrastructure.maxMonthlyGross');
    if (currency !== 'EUR') throw new Error('This version currently supports infrastructure.currency=EUR only');
    if (raw.infrastructure.publicIpv4 !== true) throw new Error('infrastructure.publicIpv4 must be true');
    if (typeof raw.infrastructure.publicIpv6 !== 'boolean') throw new Error('infrastructure.publicIpv6 must be boolean');
    if (raw.infrastructure.deleteProtection !== true || raw.infrastructure.rebuildProtection !== true) {
      throw new Error('Hetzner delete and rebuild protection must both be enabled');
    }

    infrastructure = {
      kind: 'hetzner',
      tokenEnv,
      serverName,
      serverType,
      location,
      image: infrastructureImage,
      sshPublicKeyFile,
      sshAllowedCidr,
      maxMonthlyGross,
      currency,
      publicIpv4: true,
      publicIpv6: raw.infrastructure.publicIpv6,
      deleteProtection: true,
      rebuildProtection: true,
      firewallName,
      sshKeyName,
    };
  }

  const config = {
    schemaVersion: 1,
    installationId: raw.installationId,
    target: { host, user, identityFile, strictHostKeyChecking, userKnownHostsFile },
    hermes: { image },
    provider: { kind: 'openrouter', model, keyEnv },
  };
  if (raw.brain !== undefined) {
    const repositoryName = requiredString(raw.brain.repositoryName, 'brain.repositoryName');
    const deployKeyFile = expandHome(requiredString(raw.brain.deployKeyFile, 'brain.deployKeyFile'));
    if (!SAFE_REPOSITORY_NAME.test(repositoryName)) {
      throw new Error('brain.repositoryName contains unsupported characters');
    }
    if (raw.brain.visibility !== 'private') {
      throw new Error('brain.visibility must be private');
    }
    const owner = raw.brain.owner == null ? null : requiredString(raw.brain.owner, 'brain.owner');
    const sshUrl = raw.brain.sshUrl == null ? null : requiredString(raw.brain.sshUrl, 'brain.sshUrl');
    if ((owner === null) !== (sshUrl === null)) {
      throw new Error('brain.owner and brain.sshUrl must be set together by create-brain');
    }
    if (owner !== null) {
      if (!/^[A-Za-z0-9-]{1,39}$/.test(owner)) throw new Error('brain.owner contains unsupported characters');
      const expectedSshUrl = `git@github.com:${owner}/${repositoryName}.git`;
      if (sshUrl !== expectedSshUrl) throw new Error('brain.sshUrl does not match the private Brain repository');
    }
    config.brain = { repositoryName, visibility: 'private', deployKeyFile, owner, sshUrl };
  }
  if (infrastructure) config.infrastructure = infrastructure;
  return config;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const fields = Object.keys(value).sort();
    return `{${fields.map((field) => `${JSON.stringify(field)}:${stableStringify(value[field])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintConfig(config) {
  return createHash('sha256').update(stableStringify(config)).digest('hex');
}

export async function loadConfig(configPath) {
  const absolutePath = path.resolve(expandHome(configPath));
  const raw = JSON.parse(await readFile(absolutePath, 'utf8'));
  const config = validateConfig(raw);
  const identityStat = await stat(config.target.identityFile);
  if (!identityStat.isFile()) throw new Error('target.identityFile is not a file');
  if (config.infrastructure) {
    const publicKeyStat = await stat(config.infrastructure.sshPublicKeyFile);
    if (!publicKeyStat.isFile()) throw new Error('infrastructure.sshPublicKeyFile is not a file');
  }
  if (config.brain?.owner) {
    const deployKeyStat = await stat(config.brain.deployKeyFile);
    if (!deployKeyStat.isFile()) throw new Error('brain.deployKeyFile is not a file');
  }
  return { config, configPath: absolutePath, fingerprint: fingerprintConfig(config) };
}
