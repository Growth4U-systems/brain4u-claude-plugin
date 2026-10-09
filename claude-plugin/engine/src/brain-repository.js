import { chmod, cp, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runProcess } from './process.js';

const SAFE_REPOSITORY_NAME = /^[A-Za-z0-9._-]{1,100}$/;
const REQUIRED_TEMPLATE_PATHS = [
  '.brain4u-template-version',
  'README.md',
  'CLAUDE.md',
  'AGENTS.md',
  'INDEX.md',
  'gbrain.yml',
  'governance/memory-writeback-policy.md',
  'wiki/README.md',
  'skills/brain-read/SKILL.md',
  'skills/brain-write/SKILL.md',
];

function packagedTemplatePath() {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDirectory, '../../brain-template');
}

async function validateTemplate(templatePath) {
  const version = (await readFile(path.join(templatePath, '.brain4u-template-version'), 'utf8')).trim();
  if (!/^\d+$/.test(version)) throw new Error('Brain4U template version marker is invalid');
  await Promise.all(REQUIRED_TEMPLATE_PATHS.map(async (relativePath) => {
    await readFile(path.join(templatePath, relativePath));
  }));
  return version;
}

function isRepositoryMissing(error) {
  const detail = `${error.result?.stderr ?? ''}\n${error.message ?? ''}`;
  return /Could not resolve to a Repository|HTTP 404|Not Found/i.test(detail);
}

async function inspectRepository(fullName, runProcessImpl) {
  try {
    const result = await runProcessImpl('gh', [
      'repo', 'view', fullName,
      '--json', 'nameWithOwner,url,visibility,defaultBranchRef',
    ], { timeoutMs: 30_000 });
    return JSON.parse(result.stdout);
  } catch (error) {
    if (isRepositoryMissing(error)) return null;
    throw error;
  }
}

async function repositoryHasTemplateMarker(fullName, runProcessImpl) {
  try {
    const result = await runProcessImpl('gh', [
      'api', `repos/${fullName}/contents/.brain4u-template-version`, '--jq', '.name',
    ], { timeoutMs: 30_000 });
    return result.stdout.trim() === '.brain4u-template-version';
  } catch {
    return false;
  }
}

async function regularFileExists(filePath) {
  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`${filePath} is not a regular file`);
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function ensureDeployKey(deployKeyFile, runProcessImpl) {
  const publicKeyFile = `${deployKeyFile}.pub`;
  await mkdir(path.dirname(deployKeyFile), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(deployKeyFile), 0o700);
  const privateExists = await regularFileExists(deployKeyFile);
  const publicExists = await regularFileExists(publicKeyFile);
  if (publicExists && !privateExists) {
    throw new Error('The Brain deploy public key exists but its private key is missing');
  }

  let created = false;
  if (!privateExists) {
    await runProcessImpl('ssh-keygen', [
      '-q', '-t', 'ed25519', '-N', '', '-C', 'brain4u-runtime', '-f', deployKeyFile,
    ], { timeoutMs: 30_000 });
    created = true;
  } else if (!publicExists) {
    const derived = await runProcessImpl('ssh-keygen', ['-y', '-f', deployKeyFile], { timeoutMs: 30_000 });
    await writeFile(publicKeyFile, `${derived.stdout.trim()} brain4u-runtime\n`, { mode: 0o644, flag: 'wx' });
  }
  await chmod(deployKeyFile, 0o600);
  await chmod(publicKeyFile, 0o644);
  const publicKey = (await readFile(publicKeyFile, 'utf8')).trim();
  if (!/^ssh-ed25519 [A-Za-z0-9+/=]+(?:\s|$)/.test(publicKey)) {
    throw new Error('Brain deploy public key is invalid');
  }
  return { publicKey, created };
}

function keyMaterial(publicKey) {
  return publicKey.trim().split(/\s+/).slice(0, 2).join(' ');
}

async function ensureGitHubDeployKey({ fullName, installationId, publicKey, runProcessImpl }) {
  const title = `brain4u-runtime-${installationId}`;
  const listed = await runProcessImpl('gh', [
    'api', `repos/${fullName}/keys`, '--paginate',
    '--jq', `.[] | select(.title == ${JSON.stringify(title)}) | @json`,
  ], { timeoutMs: 30_000 });
  const matches = listed.stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  if (matches.length > 1) throw new Error(`GitHub repository ${fullName} has duplicate Brain4U deploy keys`);
  if (matches.length === 1) {
    if (keyMaterial(matches[0].key) !== keyMaterial(publicKey) || matches[0].read_only !== false) {
      throw new Error(`GitHub deploy key ${title} exists with different key material or permissions`);
    }
    return { title, created: false };
  }
  await runProcessImpl('gh', [
    'api', '--method', 'POST', `repos/${fullName}/keys`,
    '-f', `title=${title}`,
    '-f', `key=${publicKey}`,
    '-F', 'read_only=false',
  ], { timeoutMs: 30_000 });
  return { title, created: true };
}

async function persistResolvedBrain(configPath, owner, sshUrl) {
  if (!configPath) throw new Error('configPath is required to connect the Brain repository');
  const raw = JSON.parse(await readFile(configPath, 'utf8'));
  const alreadyResolved = raw.brain?.owner === owner && raw.brain?.sshUrl === sshUrl;
  if (alreadyResolved) return false;
  raw.brain = { ...raw.brain, owner, sshUrl };
  const temporaryPath = path.join(path.dirname(configPath), `.config-${process.pid}-${Date.now()}.json`);
  await writeFile(temporaryPath, `${JSON.stringify(raw, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await rename(temporaryPath, configPath);
  await chmod(configPath, 0o600);
  return true;
}

export async function createBrainRepositoryCommand({
  config,
  configPath,
  templatePath = packagedTemplatePath(),
  runProcessImpl = runProcess,
  connectRuntime = true,
} = {}) {
  const repositoryName = config?.brain?.repositoryName ?? 'brain4u';
  if (!SAFE_REPOSITORY_NAME.test(repositoryName)) {
    throw new Error('Brain repository name contains unsupported characters');
  }
  if ((config?.brain?.visibility ?? 'private') !== 'private') {
    throw new Error('Brain repository must be private');
  }

  const templateVersion = await validateTemplate(templatePath);
  await runProcessImpl('gh', ['auth', 'status'], { timeoutMs: 30_000 });
  const viewer = await runProcessImpl('gh', ['api', 'user', '--jq', '.login'], { timeoutMs: 30_000 });
  const owner = viewer.stdout.trim();
  if (!/^[A-Za-z0-9-]{1,39}$/.test(owner)) throw new Error('GitHub returned an invalid account login');
  if (config.brain.owner && config.brain.owner !== owner) {
    throw new Error(`This installation belongs to GitHub account ${config.brain.owner}, but gh is authenticated as ${owner}`);
  }
  const fullName = `${owner}/${repositoryName}`;
  const sshUrl = `git@github.com:${fullName}.git`;

  const finalizeConnection = async ({ repository, alreadyExisted, repositoryCreated }) => {
    const deployKey = connectRuntime ? await ensureDeployKey(config.brain.deployKeyFile, runProcessImpl) : { created: false };
    const registeredKey = connectRuntime ? await ensureGitHubDeployKey({
      fullName,
      installationId: config.installationId,
      publicKey: deployKey.publicKey,
      runProcessImpl,
    }) : { title: null, created: false };
    const configUpdated = await persistResolvedBrain(configPath, owner, sshUrl);
    return {
      ok: true,
      command: 'create-brain',
      repository: fullName,
      url: repository.url,
      sshUrl,
      visibility: 'private',
      defaultBranch: repository.defaultBranchRef?.name ?? 'main',
      templateVersion,
      alreadyExisted,
      deployKeyTitle: registeredKey.title,
      deployKeyCreated: deployKey.created,
      deployKeyRegistered: registeredKey.created,
      configUpdated,
      runtimeAccessConfigured: connectRuntime,
      mutationsPerformed: repositoryCreated || deployKey.created || registeredKey.created || configUpdated,
    };
  };

  const existing = await inspectRepository(fullName, runProcessImpl);
  if (existing) {
    if (!(await repositoryHasTemplateMarker(fullName, runProcessImpl))) {
      throw new Error(`GitHub repository ${fullName} already exists and is not a Brain4U template; it was not modified`);
    }
    if (existing.visibility !== 'PRIVATE') {
      throw new Error(`Existing Brain4U repository ${fullName} is not private`);
    }
    return await finalizeConnection({ repository: existing, alreadyExisted: true, repositoryCreated: false });
  }

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'brain4u-repository-'));
  const repositoryPath = path.join(temporaryRoot, repositoryName);
  try {
    await cp(templatePath, repositoryPath, { recursive: true, errorOnExist: true });
    const codeownersPath = path.join(repositoryPath, '.github', 'CODEOWNERS');
    const codeowners = await readFile(codeownersPath, 'utf8');
    await writeFile(codeownersPath, codeowners.replaceAll('@OWNER', `@${owner}`));
    await runProcessImpl('git', ['-C', repositoryPath, 'init', '-b', 'main'], { timeoutMs: 30_000 });
    await runProcessImpl('git', ['-C', repositoryPath, 'config', 'user.name', 'Brain4U Installer'], { timeoutMs: 30_000 });
    await runProcessImpl('git', ['-C', repositoryPath, 'config', 'user.email', `${owner}@users.noreply.github.com`], { timeoutMs: 30_000 });
    await runProcessImpl('git', ['-C', repositoryPath, 'add', '--all'], { timeoutMs: 30_000 });
    await runProcessImpl('git', ['-C', repositoryPath, 'commit', '-m', `Initialize Brain4U template v${templateVersion}`], { timeoutMs: 30_000 });
    await runProcessImpl('gh', [
      'repo', 'create', fullName,
      '--private',
      '--source', repositoryPath,
      '--remote', 'origin',
      '--push',
      '--description', 'Private company brain powered by Brain4U',
    ], { timeoutMs: 120_000 });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  const created = await inspectRepository(fullName, runProcessImpl);
  if (!created || created.visibility !== 'PRIVATE' || created.defaultBranchRef?.name !== 'main') {
    throw new Error(`GitHub repository ${fullName} was created but failed final verification`);
  }
  if (!(await repositoryHasTemplateMarker(fullName, runProcessImpl))) {
    throw new Error(`GitHub repository ${fullName} is missing the Brain4U template marker`);
  }
  return await finalizeConnection({ repository: created, alreadyExisted: false, repositoryCreated: true });
}
