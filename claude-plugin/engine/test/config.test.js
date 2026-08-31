import assert from 'node:assert/strict';
import test from 'node:test';

import { fingerprintConfig, validateConfig } from '../src/config.js';

function validConfig() {
  return {
    schemaVersion: 1,
    installationId: 'brain4u-test',
    target: {
      host: '192.0.2.10',
      user: 'root',
      identityFile: '/tmp/test-key',
      strictHostKeyChecking: 'yes',
      userKnownHostsFile: '/tmp/test-known-hosts',
    },
    hermes: {
      image: `nousresearch/hermes-agent@sha256:${'a'.repeat(64)}`,
    },
    provider: {
      kind: 'openrouter',
      model: 'openrouter/free',
      keyEnv: 'OPENROUTER_API_KEY',
    },
  };
}

test('validates a secret-free pinned configuration', () => {
  const config = validateConfig(validConfig());
  assert.equal(config.provider.keyEnv, 'OPENROUTER_API_KEY');
  assert.equal(config.target.userKnownHostsFile, '/tmp/test-known-hosts');
  assert.match(fingerprintConfig(config), /^[a-f0-9]{64}$/);
});

test('validates a resolved private Brain repository connection', () => {
  const raw = validConfig();
  raw.brain = {
    repositoryName: 'brain4u',
    visibility: 'private',
    deployKeyFile: '/tmp/brain4u-deploy-key',
    owner: 'octocat',
    sshUrl: 'git@github.com:octocat/brain4u.git',
  };
  const config = validateConfig(raw);
  assert.equal(config.brain.owner, 'octocat');
  assert.equal(config.brain.sshUrl, 'git@github.com:octocat/brain4u.git');
});

test('rejects a Brain SSH URL that does not match its owner and repository', () => {
  const raw = validConfig();
  raw.brain = {
    repositoryName: 'brain4u',
    visibility: 'private',
    deployKeyFile: '/tmp/brain4u-deploy-key',
    owner: 'octocat',
    sshUrl: 'git@github.com:someone-else/brain4u.git',
  };
  assert.throws(() => validateConfig(raw), /does not match/);
});

test('rejects inline secrets', () => {
  const raw = validConfig();
  raw.provider.apiKey = 'must-not-be-here';
  assert.throws(() => validateConfig(raw), /Inline secret field is forbidden/);
});

test('rejects mutable Hermes image tags', () => {
  const raw = validConfig();
  raw.hermes.image = 'nousresearch/hermes-agent:latest';
  assert.throws(() => validateConfig(raw), /pin the official image/);
});

test('accepts a client-owned Hetzner infrastructure contract without a target host', () => {
  const raw = validConfig();
  delete raw.target.host;
  raw.infrastructure = {
    kind: 'hetzner',
    tokenEnv: 'HCLOUD_TOKEN',
    serverName: 'brain4u-client-test',
    serverType: 'cx23',
    location: 'nbg1',
    image: 'ubuntu-24.04',
    sshPublicKeyFile: '/tmp/test-key.pub',
    sshAllowedCidr: '192.0.2.44/32',
    maxMonthlyGross: '6.00',
    currency: 'EUR',
    publicIpv4: true,
    publicIpv6: true,
    deleteProtection: true,
    rebuildProtection: true,
  };

  const config = validateConfig(raw);
  assert.equal(config.target.host, null);
  assert.equal(config.infrastructure.tokenEnv, 'HCLOUD_TOKEN');
  assert.equal(config.infrastructure.firewallName, 'brain4u-test-ssh');
});

test('rejects Hetzner inline tokens and unsafe network or cost settings', () => {
  const base = validConfig();
  base.infrastructure = {
    kind: 'hetzner',
    tokenEnv: 'HCLOUD_TOKEN',
    serverName: 'brain4u-client-test',
    serverType: 'cx23',
    location: 'nbg1',
    image: 'ubuntu-24.04',
    sshPublicKeyFile: '/tmp/test-key.pub',
    sshAllowedCidr: '192.0.2.44/24',
    maxMonthlyGross: '6.00',
    currency: 'EUR',
    publicIpv4: true,
    publicIpv6: true,
    deleteProtection: true,
    rebuildProtection: true,
  };
  assert.throws(() => validateConfig(base), /single IPv4 \/32/);

  base.infrastructure.sshAllowedCidr = '192.0.2.44/32';
  base.infrastructure.token = 'inline-secret';
  assert.throws(() => validateConfig(base), /Inline secret field is forbidden/);
});
