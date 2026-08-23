import assert from 'node:assert/strict';
import { chmod, mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  hetznerCredentialPath,
  loadHetznerCredential,
  loadOpenRouterCredential,
  openRouterCredentialPath,
  saveHetznerCredential,
  saveOpenRouterCredential,
} from '../src/credentials.js';

const TOKEN = 'A'.repeat(64);

test('stores a Hetzner token outside state with private permissions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-credential-test-'));
  const credentialPath = await saveHetznerCredential(root, 'brain4u-test', TOKEN);

  assert.equal(credentialPath, hetznerCredentialPath(root, 'brain4u-test'));
  assert.equal(await loadHetznerCredential(root, 'brain4u-test'), TOKEN);
  assert.equal((await stat(credentialPath)).mode & 0o777, 0o600);
  assert.equal((await stat(path.dirname(credentialPath))).mode & 0o777, 0o700);
  await assert.rejects(saveHetznerCredential(root, 'brain4u-test', TOKEN), /already stored/);
});

test('refuses to read a credential with broad permissions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-credential-mode-test-'));
  const credentialPath = await saveHetznerCredential(root, 'brain4u-test', TOKEN);
  await chmod(credentialPath, 0o644);
  await assert.rejects(loadHetznerCredential(root, 'brain4u-test'), /permissions are too broad/);
});

test('stores an OpenRouter key separately with private permissions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-openrouter-credential-test-'));
  const key = `sk-or-v1-${'C'.repeat(48)}`;
  const credentialPath = await saveOpenRouterCredential(root, 'brain4u-test', key);

  assert.equal(credentialPath, openRouterCredentialPath(root, 'brain4u-test'));
  assert.equal(await loadOpenRouterCredential(root, 'brain4u-test'), key);
  assert.equal((await stat(credentialPath)).mode & 0o777, 0o600);
  assert.notEqual(credentialPath, hetznerCredentialPath(root, 'brain4u-test'));
  await assert.rejects(saveOpenRouterCredential(root, 'brain4u-test', key), /already stored/);
});
