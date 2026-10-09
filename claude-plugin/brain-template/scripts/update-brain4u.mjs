import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STATE = '.brain4u-distribution.json';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function allowedLogicPath(name) {
  return typeof name === 'string' && !name.split('/').some(part => !part || part === '.' || part === '..')
    && !name.includes('\\') && !name.includes('\0')
    && !name.split('/').some(part => part === '.env' || part.startsWith('.env.') || part === '.git' || part === 'credentials')
    && /^(CLAUDE\.md|AGENTS\.md|INDEX\.md|gbrain\.yml|schema\.md|lint-brain\.sh|install-claude-hooks\.sh|\.brain4u-template-version|(?:docs|governance|skills|commands|hooks|scripts)\/.+|agents\/chief-of-staff\/.+)$/.test(name);
}

async function ensureNoSymlink(root, relativePath) {
  let current = root;
  for (const part of relativePath.split('/')) {
    current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`Update refuses a symlink: ${relativePath}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export async function updateBrain({ root, manifest }) {
  if (manifest.schemaVersion !== 1 || !/^\d+\.\d+\.\d+$/.test(manifest.version)
    || !Array.isArray(manifest.files) || manifest.files.length > 500) throw new Error('Invalid distribution manifest');
  await ensureNoSymlink(root, STATE);
  const old = JSON.parse(await readFile(path.join(root, STATE), 'utf8'));
  if (old.schemaVersion !== undefined && old.schemaVersion !== 1) throw new Error('Invalid local distribution state');
  if (!/^\d+\.\d+\.\d+$/.test(old.version) || !old.files || typeof old.files !== 'object') throw new Error('Invalid local distribution state');
  const compareVersion = (a, b) => {
    const left = a.split('.').map(Number), right = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
    return 0;
  };
  if (compareVersion(manifest.version, old.version) < 0) throw new Error('Update refuses an older release');
  const names = new Set();
  const plan = [];
  // Validate every entry before making any change. Knowledge and secrets are excluded.
  for (const entry of manifest.files) {
    if (!allowedLogicPath(entry.path) || names.has(entry.path) || typeof entry.content !== 'string'
      || entry.content.length > 1_000_000 || sha256(entry.content) !== entry.sha256) throw new Error('Unsafe distribution entry');
    names.add(entry.path);
    await ensureNoSymlink(root, entry.path);
    let current = null;
    try { current = sha256(await readFile(path.join(root, entry.path))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const baseline = old.files?.[entry.path];
    if (current === entry.sha256) plan.push({ entry, status: 'current' });
    else if (current !== null && current !== baseline) plan.push({ entry, status: 'customized' });
    else if (current === null && baseline) plan.push({ entry, status: 'customized' });
    else plan.push({ entry, status: 'update' });
  }
  await ensureNoSymlink(root, STATE);
  const next = { ...old, version: manifest.version, files: { ...old.files } };
  for (const { entry, status } of plan) {
    if (status === 'update') {
      const filename = path.join(root, entry.path);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, entry.content);
    }
    if (status !== 'customized') next.files[entry.path] = entry.sha256;
  }
  next.customized = plan.filter(item => item.status === 'customized').map(item => item.entry.path);
  await writeFile(path.join(root, STATE), JSON.stringify(next, null, 2) + '\n');
  return { version: next.version, updated: plan.filter(item => item.status === 'update').map(item => item.entry.path), customized: next.customized };
}

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`Public distribution request failed: HTTP ${response.status}`);
  return await response.json();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const release = await download('https://api.github.com/repos/Growth4U-systems/brain4u-claude-plugin/releases/latest');
  if (!/^v\d+\.\d+\.\d+$/.test(release.tag_name)) throw new Error('Release tag is not stable');
  const manifest = await download(`https://raw.githubusercontent.com/Growth4U-systems/brain4u-claude-plugin/${release.tag_name}/distribution/brain-template-manifest.json`);
  if (`v${manifest.version}` !== release.tag_name) throw new Error('Release and manifest versions differ');
  console.log(JSON.stringify(await updateBrain({ root: process.cwd(), manifest })));
}
