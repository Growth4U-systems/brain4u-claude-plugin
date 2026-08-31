import assert from 'node:assert/strict';
import test from 'node:test';

import { buildInstallSteps } from '../src/install-steps.js';
import { renderCompose, renderHermesConfig } from '../src/templates.js';

function connectedConfig() {
  return {
    hermes: { image: `nousresearch/hermes-agent@sha256:${'a'.repeat(64)}` },
    provider: { kind: 'openrouter', model: 'openrouter/free' },
    brain: {
      owner: 'octocat',
      repositoryName: 'brain4u',
      sshUrl: 'git@github.com:octocat/brain4u.git',
      deployKeyFile: '/tmp/brain-deploy-key',
    },
  };
}

test('mounts the private Brain and makes it the Hermes working directory', () => {
  const compose = renderCompose(connectedConfig());
  assert.match(compose, /\/opt\/brain4u\/brain:\/opt\/brain/);
  assert.match(compose, /\/opt\/brain4u\/secrets\/ssh:\/opt\/brain4u-ssh:ro/);
  assert.match(compose, /working_dir: \/opt\/brain/);
  assert.match(compose, /GIT_SSH_COMMAND/);
});

test('points Hermes at the Brain index and governance rules', () => {
  const config = renderHermesConfig(connectedConfig());
  assert.match(config, /durable company memory/);
  assert.match(config, /\/opt\/brain\/INDEX\.md/);
  assert.match(config, /governance\/memory-writeback-policy\.md/);
  assert.match(config, /cwd: \/opt\/brain/);
});

test('places the Brain checkout before Hermes configuration and startup', () => {
  const ids = buildInstallSteps(connectedConfig()).map((step) => step.id);
  assert.deepEqual(ids.slice(0, 5), [
    'remote_preflight',
    'docker_runtime',
    'brain_checkout',
    'hermes_files',
    'provider_secret',
  ]);
  assert.ok(ids.indexOf('brain_checkout') < ids.indexOf('hermes_service'));
});
