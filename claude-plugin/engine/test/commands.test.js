import assert from 'node:assert/strict';
import { access, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { applyCommand, isSuccessfulSmoke, planCommand, verifyCommand } from '../src/commands.js';

test('plan evaluates checks without creating installer state', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-plan-test-'));
  const installationId = 'brain4u-test';
  const result = await planCommand({
    config: {
      installationId,
      target: { user: 'root', host: '192.0.2.10' },
      provider: { keyEnv: 'BRAIN4U_TEST_PROVIDER_KEY' },
    },
    fingerprint: 'fingerprint',
    stateRoot: root,
    steps: [{ id: 'probe', description: 'probe', check: async () => true }],
  });

  assert.equal(result.mutationsPerformed, false);
  assert.equal(result.steps[0].applied, true);
  await assert.rejects(access(path.join(root, installationId, 'state.json')), /ENOENT/);
});

test('plan requires create-brain before infrastructure work', async () => {
  await assert.rejects(planCommand({
    config: {
      installationId: 'brain4u-test',
      brain: { repositoryName: 'brain4u', owner: null, sshUrl: null },
      target: { host: '192.0.2.10' },
    },
    fingerprint: 'fingerprint',
    stateRoot: '/tmp/brain4u-unresolved-test',
    steps: [],
  }), /run create-brain/);
});

test('verify confirms the private Brain is mounted inside Hermes', async () => {
  const image = `nousresearch/hermes-agent@sha256:${'a'.repeat(64)}`;
  const result = await verifyCommand({
    config: {
      installationId: 'brain4u-test',
      target: { host: '192.0.2.80', user: 'root' },
      hermes: { image },
      brain: { owner: 'octocat', sshUrl: 'git@github.com:octocat/brain4u.git' },
    },
    runSshImpl: async () => ({ stdout: [
      'docker=active',
      'container=running',
      `image=${image}`,
      'env_mode=600',
      'canary=78d000b3297402588017b17f28ddaafd23884a6c76f53ad75361f9a7191b897a',
      'health={"status":"ok"}',
      'brain_marker=present',
      'brain_origin=git@github.com:octocat/brain4u.git',
      'brain_workdir=/opt/brain',
      'brain_mounted=true',
      'brain_runtime_access=true',
      'brain_sync=active',
      'secret_in_logs=false',
    ].join('\n') }),
    isTcpPortOpenImpl: async () => false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.checks.brainRepository.mountedInHermes, true);
  assert.equal(result.checks.brainRepository.runtimeCanReadAndWrite, true);
});

test('verify rejects a root-readable mount that the agent cannot write', async () => {
  const image = `nousresearch/hermes-agent@sha256:${'a'.repeat(64)}`;
  const result = await verifyCommand({
    config: {
      installationId: 'brain4u-test', target: { host: '192.0.2.80', user: 'root' },
      hermes: { image }, brain: { owner: 'octocat', sshUrl: 'git@github.com:octocat/brain4u.git' },
    },
    runSshImpl: async () => ({ stdout: [
      'docker=active', 'container=running', `image=${image}`, 'env_mode=600',
      'canary=78d000b3297402588017b17f28ddaafd23884a6c76f53ad75361f9a7191b897a',
      'health={"status":"ok"}', 'brain_marker=present',
      'brain_origin=git@github.com:octocat/brain4u.git', 'brain_workdir=/opt/brain',
      'brain_mounted=true', 'brain_runtime_access=false', 'brain_sync=active', 'secret_in_logs=false',
    ].join('\n') }),
    isTcpPortOpenImpl: async () => false,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, ['brain_runtime_permissions']);
});

test('accepts a healthy inference response containing the smoke marker', () => {
  assert.equal(isSuccessfulSmoke({
    content: 'Additional text\nBRAIN4U_OK',
    finish_reason: 'stop',
    error: null,
  }), true);
  assert.equal(isSuccessfulSmoke({
    content: 'No marker',
    finish_reason: 'stop',
    error: null,
  }), false);
});

test('resume refuses missing state before any infrastructure request', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-resume-infra-test-'));
  let infrastructureRequests = 0;
  const infrastructureClient = {
    async listAll() { infrastructureRequests += 1; return []; },
    async get() { infrastructureRequests += 1; return {}; },
  };

  await assert.rejects(applyCommand({
    config: {
      installationId: 'brain4u-test',
      target: { host: null },
      infrastructure: {},
    },
    fingerprint: 'fingerprint',
    stateRoot: root,
    resume: true,
    infrastructureClient,
  }), /No installation state exists to resume/);
  assert.equal(infrastructureRequests, 0);
});

test('verify resolves a managed VPS host before connecting', async () => {
  let connectedHost = null;
  const image = `nousresearch/hermes-agent@sha256:${'a'.repeat(64)}`;
  const result = await verifyCommand({
    config: {
      installationId: 'brain4u-test',
      target: { host: null, user: 'root' },
      infrastructure: {},
      hermes: { image },
    },
    infrastructurePlan: async () => ({ actions: [], resolvedHost: '192.0.2.80' }),
    runSshImpl: async (config) => {
      connectedHost = config.target.host;
      return { stdout: [
        'docker=active',
        'container=running',
        `image=${image}`,
        'env_mode=600',
        'canary=78d000b3297402588017b17f28ddaafd23884a6c76f53ad75361f9a7191b897a',
        'health={"status":"ok"}',
        'secret_in_logs=false',
      ].join('\n') };
    },
    isTcpPortOpenImpl: async (host) => {
      assert.equal(host, '192.0.2.80');
      return false;
    },
  });

  assert.equal(connectedHost, '192.0.2.80');
  assert.equal(result.ok, true);
});

test('verify refuses managed infrastructure with pending actions', async () => {
  await assert.rejects(verifyCommand({
    config: { installationId: 'brain4u-test', target: { host: null }, infrastructure: {} },
    infrastructurePlan: async () => ({ actions: ['attach_firewall'], resolvedHost: '192.0.2.80' }),
  }), /Infrastructure is not reconciled: attach_firewall/);
});

test('verify retries a transient remote startup failure', async () => {
  let attempts = 0;
  let waits = 0;
  const image = `nousresearch/hermes-agent@sha256:${'a'.repeat(64)}`;
  const result = await verifyCommand({
    config: {
      installationId: 'brain4u-test',
      target: { host: '192.0.2.80', user: 'root' },
      hermes: { image },
    },
    verificationAttempts: 2,
    waitImpl: async (milliseconds) => {
      assert.equal(milliseconds, 2_000);
      waits += 1;
    },
    runSshImpl: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('service is still starting');
      return { stdout: [
        'docker=active',
        'container=running',
        `image=${image}`,
        'env_mode=600',
        'canary=78d000b3297402588017b17f28ddaafd23884a6c76f53ad75361f9a7191b897a',
        'health={"status":"ok"}',
        'secret_in_logs=false',
      ].join('\n') };
    },
    isTcpPortOpenImpl: async () => false,
  });

  assert.equal(result.ok, true);
  assert.equal(attempts, 2);
  assert.equal(waits, 1);
});
