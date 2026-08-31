import { randomBytes } from 'node:crypto';
import { chmod, lstat, mkdir, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { validateConfig } from './config.js';
import { runProcess } from './process.js';

const HERMES_IMAGE = 'nousresearch/hermes-agent@sha256:123bd6f17c355ba6f9e7b934749d435b319be6607b6ef56f4ba0e45f3fbba46a';
const PUBLIC_IP_URL = 'https://api.ipify.org';
const SAFE_INSTALLATION_ID = /^[a-z0-9][a-z0-9-]{2,62}$/;

function generatedInstallationId(now = new Date()) {
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-').toLowerCase();
  return `brain4u-${timestamp}-${randomBytes(2).toString('hex')}`;
}

function validateIpv4(value) {
  if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value)) return false;
  return value.split('.').map(Number).every((octet) => octet <= 255);
}

export async function discoverPublicIpv4({ fetchImpl = globalThis.fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(PUBLIC_IP_URL, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(`Could not detect the public IPv4 address: ${error.message ?? error}`);
  }
  if (!response.ok) throw new Error(`Could not detect the public IPv4 address: HTTP ${response.status}`);
  const address = (await response.text()).trim();
  if (!validateIpv4(address)) throw new Error('Public IP service did not return a valid IPv4 address');
  return address;
}

export async function ensureDedicatedSshKey({ homeDirectory = os.homedir(), runProcessImpl = runProcess } = {}) {
  const sshDirectory = path.join(homeDirectory, '.ssh');
  const privateKey = path.join(sshDirectory, 'brain4u_installer_ed25519');
  const publicKey = `${privateKey}.pub`;
  await mkdir(sshDirectory, { recursive: true, mode: 0o700 });
  await chmod(sshDirectory, 0o700);

  let privateExists = false;
  let publicExists = false;
  try {
    const metadata = await lstat(privateKey);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('Brain4U private SSH key is not a regular file');
    privateExists = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    const metadata = await lstat(publicKey);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('Brain4U public SSH key is not a regular file');
    publicExists = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (publicExists && !privateExists) {
    throw new Error('The Brain4U public SSH key exists but its private key is missing');
  }

  let created = false;
  if (!privateExists) {
    await runProcessImpl('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'brain4u-installer', '-f', privateKey], { timeoutMs: 30_000 });
    created = true;
  } else if (!publicExists) {
    const result = await runProcessImpl('ssh-keygen', ['-y', '-f', privateKey], { timeoutMs: 30_000 });
    await writeFile(publicKey, `${result.stdout.trim()}\n`, { mode: 0o644, flag: 'wx' });
  }
  await chmod(privateKey, 0o600);
  await chmod(publicKey, 0o644);
  const fingerprintResult = await runProcessImpl('ssh-keygen', ['-lf', publicKey, '-E', 'sha256'], { timeoutMs: 30_000 });
  const fingerprint = fingerprintResult.stdout.trim().split(/\s+/)[1];
  if (!fingerprint?.startsWith('SHA256:')) throw new Error('Could not read the Brain4U SSH key fingerprint');
  return { privateKey, publicKey, fingerprint, created };
}

export async function initializeInstallation({
  stateRoot,
  installationId = generatedInstallationId(),
  homeDirectory = os.homedir(),
  fetchImpl = globalThis.fetch,
  ensureSshKeyImpl = ensureDedicatedSshKey,
} = {}) {
  if (!stateRoot) throw new Error('stateRoot is required');
  if (!SAFE_INSTALLATION_ID.test(installationId)) {
    throw new Error('installationId must contain 3 to 63 lowercase letters, numbers or hyphens');
  }
  const installationDirectory = path.resolve(stateRoot, installationId);
  const configPath = path.join(installationDirectory, 'config.json');
  const knownHostsPath = path.join(installationDirectory, 'known-hosts');
  try {
    await lstat(configPath);
    throw new Error(`Installation configuration already exists: ${configPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const [publicIpv4, sshKey] = await Promise.all([
    discoverPublicIpv4({ fetchImpl }),
    ensureSshKeyImpl({ homeDirectory }),
  ]);
  await mkdir(installationDirectory, { recursive: true, mode: 0o700 });
  await chmod(installationDirectory, 0o700);

  const rawConfig = {
    schemaVersion: 1,
    installationId,
    brain: {
      repositoryName: 'brain4u',
      visibility: 'private',
      deployKeyFile: path.join(installationDirectory, 'credentials', 'brain-deploy-key'),
    },
    infrastructure: {
      kind: 'hetzner',
      tokenEnv: 'HCLOUD_TOKEN',
      serverName: installationId,
      serverType: 'cx23',
      location: 'nbg1',
      image: 'ubuntu-24.04',
      sshPublicKeyFile: sshKey.publicKey,
      sshAllowedCidr: `${publicIpv4}/32`,
      maxMonthlyGross: '6.00',
      currency: 'EUR',
      publicIpv4: true,
      publicIpv6: true,
      deleteProtection: true,
      rebuildProtection: true,
    },
    target: {
      user: 'root',
      identityFile: sshKey.privateKey,
      strictHostKeyChecking: 'accept-new',
      userKnownHostsFile: knownHostsPath,
    },
    hermes: { image: HERMES_IMAGE },
    provider: {
      kind: 'openrouter',
      model: 'openrouter/free',
      keyEnv: 'OPENROUTER_API_KEY',
    },
  };
  validateConfig(rawConfig);
  const temporaryPath = path.join(installationDirectory, `.config-${process.pid}-${Date.now()}.json`);
  await writeFile(temporaryPath, `${JSON.stringify(rawConfig, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await rename(temporaryPath, configPath);
  await chmod(configPath, 0o600);
  return {
    ok: true,
    command: 'init',
    installationId,
    configPath,
    publicIpv4,
    sshKeyFingerprint: sshKey.fingerprint,
    sshKeyCreated: sshKey.created,
    mutationsPerformed: true,
    remoteMutationsPerformed: false,
    nextCommand: 'create-brain',
  };
}
