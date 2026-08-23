import { chmod, lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function credentialDirectory(stateRoot, installationId) {
  return path.resolve(stateRoot, installationId, 'credentials');
}

export function hetznerCredentialPath(stateRoot, installationId) {
  return path.join(credentialDirectory(stateRoot, installationId), 'hetzner-token');
}

export function openRouterCredentialPath(stateRoot, installationId) {
  return path.join(credentialDirectory(stateRoot, installationId), 'openrouter-key');
}

function validateHetznerToken(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    throw new Error('Hetzner token has an unsupported format');
  }
  return token;
}

export function validateOpenRouterKey(key) {
  if (typeof key !== 'string' || !/^sk-or-v1-[A-Za-z0-9_-]{20,256}$/.test(key)) {
    throw new Error('OpenRouter key has an unsupported format');
  }
  return key;
}

async function loadCredential(credentialPath, validate, name) {
  try {
    const metadata = await lstat(credentialPath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`Stored ${name} credential is not a regular file`);
    }
    if ((metadata.mode & 0o077) !== 0) {
      throw new Error(`Stored ${name} credential permissions are too broad`);
    }
    return validate((await readFile(credentialPath, 'utf8')).trim());
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function saveCredential({ stateRoot, installationId, value, credentialPath, validate, name, temporaryPrefix }) {
  const validatedValue = validate(value.trim());
  const directory = credentialDirectory(stateRoot, installationId);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);

  try {
    await lstat(credentialPath);
    throw new Error(`A ${name} credential is already stored for this installation`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const temporaryPath = path.join(directory, `.${temporaryPrefix}-${process.pid}-${Date.now()}`);
  await writeFile(temporaryPath, validatedValue, { mode: 0o600, flag: 'wx' });
  await rename(temporaryPath, credentialPath);
  await chmod(credentialPath, 0o600);
  return credentialPath;
}

export async function loadHetznerCredential(stateRoot, installationId) {
  return await loadCredential(
    hetznerCredentialPath(stateRoot, installationId),
    validateHetznerToken,
    'Hetzner',
  );
}

export async function saveHetznerCredential(stateRoot, installationId, token) {
  return await saveCredential({
    stateRoot,
    installationId,
    value: token,
    credentialPath: hetznerCredentialPath(stateRoot, installationId),
    validate: validateHetznerToken,
    name: 'Hetzner',
    temporaryPrefix: 'hetzner-token',
  });
}

export async function loadOpenRouterCredential(stateRoot, installationId) {
  return await loadCredential(
    openRouterCredentialPath(stateRoot, installationId),
    validateOpenRouterKey,
    'OpenRouter',
  );
}

export async function saveOpenRouterCredential(stateRoot, installationId, key) {
  return await saveCredential({
    stateRoot,
    installationId,
    value: key,
    credentialPath: openRouterCredentialPath(stateRoot, installationId),
    validate: validateOpenRouterKey,
    name: 'OpenRouter',
    temporaryPrefix: 'openrouter-key',
  });
}
