import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runSteps } from '../src/core.js';
import { StateStore } from '../src/state-store.js';

test('resumes after failure without rerunning a satisfied step', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-resume-test-'));
  const stateStore = new StateStore(root, 'brain4u-test');
  const config = {
    installationId: 'brain4u-test',
    provider: { keyEnv: 'BRAIN4U_TEST_PROVIDER_KEY' },
  };
  let firstApplied = false;
  let firstRuns = 0;
  let secondApplied = false;
  let secondRuns = 0;
  const steps = [
    {
      id: 'first',
      description: 'first',
      check: async () => firstApplied,
      run: async () => {
        firstRuns += 1;
        firstApplied = true;
      },
    },
    {
      id: 'second',
      description: 'second',
      check: async () => secondApplied,
      run: async () => {
        secondRuns += 1;
        if (secondRuns === 1) throw new Error('temporary failure');
        secondApplied = true;
      },
    },
  ];

  await assert.rejects(runSteps({ config, fingerprint: 'same', stateStore, steps }), /temporary failure/);
  const failedState = await stateStore.load();
  assert.equal(failedState.steps.first.status, 'completed');
  assert.equal(failedState.steps.second.status, 'failed');

  const completed = await runSteps({ config, fingerprint: 'same', stateStore, steps, requireExisting: true });
  assert.equal(completed.status, 'completed');
  assert.equal(firstRuns, 1);
  assert.equal(secondRuns, 2);
});

test('refuses to resume with changed configuration', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-fingerprint-test-'));
  const stateStore = new StateStore(root, 'brain4u-test');
  const config = {
    installationId: 'brain4u-test',
    provider: { keyEnv: 'BRAIN4U_TEST_PROVIDER_KEY' },
  };
  const steps = [{ id: 'done', description: 'done', check: async () => true, run: async () => {} }];

  await runSteps({ config, fingerprint: 'original', stateStore, steps });
  await assert.rejects(
    runSteps({ config, fingerprint: 'changed', stateStore, steps, requireExisting: true }),
    /Configuration changed/,
  );
});

test('does not run a step whose postcondition is already satisfied', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-satisfied-test-'));
  const stateStore = new StateStore(root, 'brain4u-test');
  const config = {
    installationId: 'brain4u-test',
    provider: { keyEnv: 'BRAIN4U_TEST_PROVIDER_KEY' },
  };
  let runs = 0;
  const steps = [{
    id: 'already_done',
    description: 'already done',
    check: async () => true,
    run: async () => { runs += 1; },
  }];

  const state = await runSteps({ config, fingerprint: 'same', stateStore, steps });
  assert.equal(state.status, 'completed');
  assert.equal(state.steps.already_done.status, 'completed');
  assert.equal(runs, 0);
});
