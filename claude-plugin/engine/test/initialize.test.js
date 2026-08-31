import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { discoverPublicIpv4, initializeInstallation } from '../src/initialize.js';

test('creates a private deterministic installation configuration without secrets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-init-test-'));
  const keyRoot = await mkdtemp(path.join(os.tmpdir(), 'brain4u-init-key-test-'));
  const privateKey = path.join(keyRoot, 'brain4u');
  const publicKey = `${privateKey}.pub`;
  await writeFile(privateKey, 'private-test-material', { mode: 0o600 });
  await writeFile(publicKey, 'ssh-ed25519 public-test-material', { mode: 0o644 });
  const result = await initializeInstallation({
    stateRoot: root,
    installationId: 'brain4u-generated-test',
    fetchImpl: async () => new Response('192.0.2.55\n', { status: 200 }),
    ensureSshKeyImpl: async () => ({
      privateKey,
      publicKey,
      fingerprint: 'SHA256:test',
      created: true,
    }),
  });

  const config = JSON.parse(await readFile(result.configPath, 'utf8'));
  assert.equal(config.installationId, 'brain4u-generated-test');
  assert.deepEqual(config.brain, {
    repositoryName: 'brain4u',
    visibility: 'private',
    deployKeyFile: path.join(root, 'brain4u-generated-test', 'credentials', 'brain-deploy-key'),
  });
  assert.equal(config.infrastructure.sshAllowedCidr, '192.0.2.55/32');
  assert.equal(config.infrastructure.maxMonthlyGross, '6.00');
  assert.equal(config.target.identityFile, privateKey);
  assert.equal(result.nextCommand, 'create-brain');
  assert.equal((await stat(result.configPath)).mode & 0o777, 0o600);
  assert.equal(JSON.stringify(config).includes('private-test-material'), false);
  await assert.rejects(
    initializeInstallation({
      stateRoot: root,
      installationId: 'brain4u-generated-test',
      fetchImpl: async () => new Response('192.0.2.55', { status: 200 }),
      ensureSshKeyImpl: async () => ({ privateKey, publicKey, fingerprint: 'SHA256:test', created: false }),
    }),
    /already exists/,
  );
});

test('rejects an invalid public IP response', async () => {
  await assert.rejects(
    discoverPublicIpv4({ fetchImpl: async () => new Response('not-an-ip', { status: 200 }) }),
    /did not return a valid IPv4/,
  );
});

test('rejects an unsafe installation id before local preparation', async () => {
  let localPreparationStarted = false;
  await assert.rejects(
    initializeInstallation({
      stateRoot: '/tmp/brain4u-id-test',
      installationId: '../outside',
      fetchImpl: async () => {
        localPreparationStarted = true;
        return new Response('192.0.2.55', { status: 200 });
      },
      ensureSshKeyImpl: async () => {
        localPreparationStarted = true;
      },
    }),
    /installationId must contain/,
  );
  assert.equal(localPreparationStarted, false);
});
