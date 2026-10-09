import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sha256, updateBrain } from '../claude-plugin/brain-template/scripts/update-brain4u.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-updates-'));
  await mkdir(path.join(root, 'skills/example'), { recursive: true });
  await mkdir(path.join(root, 'wiki/company/decisions'), { recursive: true });
  await writeFile(path.join(root, 'AGENTS.md'), 'official v1');
  await writeFile(path.join(root, 'skills/example/SKILL.md'), 'owner customized instructions');
  await writeFile(path.join(root, 'wiki/company/decisions/client.md'), 'private company decision');
  await writeFile(path.join(root, '.brain4u-distribution.json'), JSON.stringify({ version: '0.3.2', files: { 'AGENTS.md': sha256('official v1'), 'skills/example/SKILL.md': sha256('original skill') } }));
  return root;
}
const entry = (name, content) => ({ path: name, content, sha256: sha256(content) });

test('released logic updates preserve business data and customized skills', async () => {
  const root = await fixture();
  const result = await updateBrain({ root, manifest: { schemaVersion: 1, version: '0.4.0', files: [entry('AGENTS.md', 'official v2'), entry('skills/example/SKILL.md', 'official skill v2')] } });
  assert.deepEqual(result.updated, ['AGENTS.md']);
  assert.deepEqual(result.customized, ['skills/example/SKILL.md']);
  assert.equal(await readFile(path.join(root, 'wiki/company/decisions/client.md'), 'utf8'), 'private company decision');
  assert.equal(await readFile(path.join(root, 'skills/example/SKILL.md'), 'utf8'), 'owner customized instructions');
});

test('rejects data paths and bad checksums before changing any file', async () => {
  for (const bad of [entry('wiki/company/decisions/client.md', 'overwrite'), entry('docs/.env', 'credential'), { ...entry('AGENTS.md', 'tampered'), sha256: sha256('different') }, entry('../outside.md', 'escape')]) {
    const root = await fixture();
    await assert.rejects(updateBrain({ root, manifest: { schemaVersion: 1, version: '0.4.0', files: [entry('INDEX.md', 'new index'), bad] } }), /Unsafe/);
    await assert.rejects(readFile(path.join(root, 'INDEX.md')), /ENOENT/);
  }
});

test('local state symlinks are refused before the target is read or modified', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-state-'));
  const outside = path.join(await mkdtemp(path.join(os.tmpdir(), 'brain4u-state-target-')), 'state.json');
  await writeFile(outside, 'private unrelated data');
  await symlink(outside, path.join(root, '.brain4u-distribution.json'));
  await assert.rejects(updateBrain({ root, manifest: { schemaVersion: 1, version: '0.4.0', files: [] } }), /symlink/);
  assert.equal(await readFile(outside, 'utf8'), 'private unrelated data');
});

test('updates cannot silently downgrade a newer installation', async () => {
  const root = await fixture();
  await assert.rejects(updateBrain({ root, manifest: { schemaVersion: 1, version: '0.3.1', files: [entry('AGENTS.md', 'old logic')] } }), /older release/);
  assert.equal(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), 'official v1');
});

test('refuses a symlink leading outside the Brain', async () => {
  const root = await fixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'brain4u-outside-'));
  await symlink(outside, path.join(root, 'hooks'));
  await assert.rejects(updateBrain({ root, manifest: { schemaVersion: 1, version: '0.4.0', files: [entry('hooks/new.sh', 'unexpected write')] } }), /symlink/);
});
