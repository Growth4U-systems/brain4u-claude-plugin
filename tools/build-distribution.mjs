import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { allowedLogicPath, sha256 } from '../claude-plugin/brain-template/scripts/update-brain4u.mjs';

const root = path.resolve('claude-plugin/brain-template');
const { version } = JSON.parse(await readFile('claude-plugin/.claude-plugin/plugin.json', 'utf8'));
const files = [];
async function scan(relative = '') {
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error('Template contains a symlink');
    if (entry.isDirectory()) await scan(name);
    else if (allowedLogicPath(name)) {
      const content = await readFile(path.join(root, name), 'utf8');
      files.push({ path: name, content, sha256: sha256(content) });
    }
  }
}
await scan();
files.sort((a, b) => a.path.localeCompare(b.path));
await mkdir('distribution', { recursive: true });
await writeFile('distribution/brain-template-manifest.json', JSON.stringify({ schemaVersion: 1, version, files }, null, 2) + '\n');
await writeFile(path.join(root, '.brain4u-distribution.json'), JSON.stringify({ schemaVersion: 1, version, files: Object.fromEntries(files.map(item => [item.path, item.sha256])), customized: [] }, null, 2) + '\n');
console.log(JSON.stringify({ version, logicFiles: files.length, businessDataIncluded: false }));
