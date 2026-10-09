import { execFile } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const secret = /(?:xox[baprs]-[A-Za-z0-9-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:ant-|or-v1-|proj-)?[A-Za-z0-9_-]{32,}|AIza[A-Za-z0-9_-]{35}|(?:AKIA|ASIA)[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|"private_key"\s*:)/;

export async function publishMemory({ root, relativePath }) {
  if (!/^wiki\/company\/(learnings|decisions)\/[a-z0-9][a-z0-9._-]*\.md$/.test(relativePath)) throw new Error('Only company learning or decision records can be published directly');
  let filename = root;
  for (const part of relativePath.split('/')) {
    filename = path.join(filename, part);
    if ((await lstat(filename)).isSymbolicLink()) throw new Error('Memory publication refuses symlinks');
  }
  await readFile(path.join(root, '.brain4u-template-version'));
  const content = await readFile(filename, 'utf8');
  const header = content.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n/);
  if (!header || !/^type:\s*(learning|decision)\s*$/m.test(header[1])
    || !/^privacy:\s*shared\s*$/m.test(header[1]) || !/^date:\s*\d{4}-\d{2}-\d{2}\s*$/m.test(header[1])
    || !/^owner:\s*(?!["']?["']?\s*$).+\S/m.test(header[1])
    || !/^sources:\s*(?:\[(?!\s*\]).+\]|\r?\n\s*-\s*\S.*)$/m.test(header[1])) throw new Error('Memory requires type, privacy, date, owner and a source');
  if (secret.test(content)) throw new Error('Sensitive content detected; redact the record before publication');
  const git = async (...args) => (await exec('git', ['-C', root, ...args], { maxBuffer: 1_000_000 })).stdout.trim();
  if (await git('branch', '--show-current') !== 'main') throw new Error('Publish from main; behavior changes require a reviewed pull request');
  if (await git('diff', '--cached', '--name-only')) throw new Error('Preserve the existing staged work and reconcile it before publication');
  await git('fetch', '--quiet', 'origin', 'main');
  const head = await git('rev-parse', 'HEAD'), remote = await git('rev-parse', 'origin/main');
  if (head !== remote) throw new Error('Reconcile the local and remote Brain before publication; no work was discarded');
  const changed = await git('status', '--porcelain', '--', relativePath);
  if (!changed) return { canonical: true, changed: false, path: relativePath, commit: head };
  await git('add', '--', relativePath);
  await exec('bash', [path.join(root, 'lint-brain.sh')], { cwd: root, maxBuffer: 1_000_000 });
  await git('commit', '--quiet', '--only', '-m', `Remember ${path.basename(relativePath, '.md')}`, '--', relativePath);
  await git('push', '--quiet', 'origin', 'HEAD:main');
  const commit = await git('rev-parse', 'HEAD');
  const published = (await git('ls-remote', 'origin', 'refs/heads/main')).split(/\s/)[0];
  if (published !== commit) throw new Error('The published commit could not be verified');
  return { canonical: true, changed: true, path: relativePath, commit };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await publishMemory({ root: process.cwd(), relativePath: process.argv[2] ?? '' }))); }
  catch { console.error('Memory was not verified as published. Check metadata, privacy, branch, staged work, lint and repository permissions; preserve any local work.'); process.exitCode = 1; }
}
