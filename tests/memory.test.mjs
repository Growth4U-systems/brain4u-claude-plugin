import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { publishMemory } from '../claude-plugin/brain-template/scripts/publish-memory.mjs';

const exec = promisify(execFile);
const template = path.resolve('claude-plugin/brain-template');
const recordPath = 'wiki/company/learnings/2026-10-09-example.md';
const record = '---\ntype: learning\nprivacy: shared\ndate: 2026-10-09\nowner: Example owner\nsources: ["Synthetic installation test"]\n---\n\nA synthetic company learned to verify an outcome before reporting it.\n';
async function fixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'brain4u-memory-'));
  const root = path.join(base, 'brain'), remote = path.join(base, 'remote.git');
  await cp(template, root, { recursive: true });
  await exec('git', ['init', '--bare', '--initial-branch=main', remote]);
  const git = async (...args) => (await exec('git', ['-C', root, ...args])).stdout.trim();
  await git('init', '--initial-branch=main');
  await git('config', 'user.name', 'Synthetic owner');
  await git('config', 'user.email', 'example@invalid.test');
  await git('add', '.');
  await git('commit', '-m', 'Synthetic template');
  await git('remote', 'add', 'origin', remote);
  await git('push', '-u', 'origin', 'main');
  await mkdir(path.dirname(path.join(root, recordPath)), { recursive: true });
  await writeFile(path.join(root, recordPath), record);
  return { base, root, remote, git };
}

test('authorized memory is recovered from a fresh clone and unrelated work stays local', async () => {
  const { base, root, remote, git } = await fixture();
  await writeFile(path.join(root, 'AGENTS.md'), 'Unrelated local customization');
  const result = await publishMemory({ root, relativePath: recordPath });
  assert.equal(result.canonical, true);
  const clone = path.join(base, 'fresh-brain');
  await exec('git', ['clone', remote, clone]);
  assert.equal(await readFile(path.join(clone, recordPath), 'utf8'), record);
  assert.notEqual(await readFile(path.join(clone, 'AGENTS.md'), 'utf8'), 'Unrelated local customization');
  assert.match(await git('status', '--porcelain'), /AGENTS\.md/);
  assert.equal((await publishMemory({ root, relativePath: recordPath })).changed, false);
});

test('staged work and behavior paths are preserved rather than published', async () => {
  const { root, git } = await fixture();
  await writeFile(path.join(root, 'AGENTS.md'), 'Staged local customization');
  await git('add', 'AGENTS.md');
  await assert.rejects(publishMemory({ root, relativePath: recordPath }), /staged work/);
  assert.equal(await git('diff', '--cached', '--name-only'), 'AGENTS.md');
  await assert.rejects(publishMemory({ root, relativePath: 'AGENTS.md' }), /Only company/);
});

test('missing provenance and credentials fail before staging or committing', async () => {
  for (const content of [record.replace('sources: ["Synthetic installation test"]', 'sources: []'), record + 'xoxb-' + 'a'.repeat(30)]) {
    const { root, git } = await fixture();
    const head = await git('rev-parse', 'HEAD');
    await writeFile(path.join(root, recordPath), content);
    await assert.rejects(publishMemory({ root, relativePath: recordPath }));
    assert.equal(await git('diff', '--cached', '--name-only'), '');
    assert.equal(await git('rev-parse', 'HEAD'), head);
  }
});

test('unpublished unrelated commits are not pushed with a memory record', async () => {
  const { root, git } = await fixture();
  await writeFile(path.join(root, 'AGENTS.md'), 'Unrelated committed customization');
  await git('add', 'AGENTS.md');
  await git('commit', '-m', 'Unpublished work');
  const remote = await git('rev-parse', 'origin/main');
  await assert.rejects(publishMemory({ root, relativePath: recordPath }), /Reconcile/);
  assert.equal((await git('ls-remote', 'origin', 'refs/heads/main')).split(/\s/)[0], remote);
});
