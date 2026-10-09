import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createBrainRepositoryCommand } from '../claude-plugin/engine/src/brain-repository.js';

async function files(root) {
  const result = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    const name = path.join(root, item.name);
    if (item.isDirectory()) result.push(...await files(name));
    else result.push(name);
  }
  return result;
}

test('the distributed runtime and template contain no internal Brain or live Growth4U endpoint', async () => {
  const roots = ['claude-plugin/brain-template', 'claude-plugin/engine/src', 'claude-plugin/vps', 'claude-plugin/contracts'];
  const forbidden = /Growth4U-systems\/(?:Brain4U|g4u-brain)(?:\.git|[\/"'\s]|$)|\/Users\/martin\/g4u-brain|178\.104\.69\.67|83\.43\.57\.229|(?:app|staging)\.sanchocmo\.ai|hooks\.slack\.com\/services\//i;
  for (const root of roots) for (const name of await files(root)) {
    assert.equal(forbidden.test(await readFile(name, 'utf8')), false, `Private installation reference in ${name}`);
  }
});

test('an external owner cannot reuse a configuration belonging to another company', async () => {
  const calls = [];
  await assert.rejects(createBrainRepositoryCommand({
    config: { installationId: 'brain4u-outside', brain: { repositoryName: 'brain4u', visibility: 'private', owner: 'Growth4U-systems' } },
    connectRuntime: true,
    runProcessImpl: async (command, args) => {
      calls.push([command, ...args]);
      if (command === 'gh' && args[0] === 'auth') return { stdout: '' };
      if (command === 'gh' && args[0] === 'api' && args[1] === 'user') return { stdout: 'outside-owner\n' };
      throw new Error('Unexpected private repository or credential access');
    },
  }), /belongs to GitHub account/);
  assert.equal(calls.length, 2);
});
