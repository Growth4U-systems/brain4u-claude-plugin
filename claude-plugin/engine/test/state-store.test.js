import assert from 'node:assert/strict';
import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { StateStore, newState } from '../src/state-store.js';

test('writes installer state atomically with private permissions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-state-test-'));
  const store = new StateStore(root, 'brain4u-test');
  const config = { installationId: 'brain4u-test' };
  const state = newState(config, 'fingerprint', [{ id: 'one' }], new Date('2026-08-22T00:00:00Z'));

  await store.save(state);

  assert.deepEqual(await store.load(), state);
  assert.equal((await stat(store.directory)).mode & 0o777, 0o700);
  assert.equal((await stat(store.path)).mode & 0o777, 0o600);
});

test('prevents concurrent installers and releases ownership to history', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-lock-test-'));
  const firstStore = new StateStore(root, 'brain4u-test');
  const secondStore = new StateStore(root, 'brain4u-test');
  const firstLock = await firstStore.acquireLock();

  await assert.rejects(secondStore.acquireLock(), /Another installer process is active/);
  await firstStore.releaseLock(firstLock);

  const secondLock = await secondStore.acquireLock();
  await secondStore.releaseLock(secondLock);
  assert.equal((await stat(firstStore.lockHistoryDirectory)).mode & 0o777, 0o700);
});
