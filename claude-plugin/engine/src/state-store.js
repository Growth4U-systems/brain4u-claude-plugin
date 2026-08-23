import { mkdir, open, readFile, rename, chmod, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export class StateStore {
  constructor(rootDir, installationId) {
    this.directory = path.resolve(rootDir, installationId);
    this.path = path.join(this.directory, 'state.json');
    this.infrastructurePath = path.join(this.directory, 'infrastructure.json');
    this.lockPath = path.join(this.directory, 'active.lock');
    this.lockHistoryDirectory = path.join(this.directory, 'lock-history');
  }

  async load() {
    try {
      return JSON.parse(await readFile(this.path, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(state) {
    await this.savePrivateJson(this.path, state, '.state');
  }

  async saveInfrastructure(infrastructure) {
    await this.savePrivateJson(this.infrastructurePath, infrastructure, '.infrastructure');
  }

  async savePrivateJson(destination, value, prefix) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
    const temporaryPath = path.join(this.directory, `${prefix}-${process.pid}-${Date.now()}.json`);
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, destination);
    await chmod(destination, 0o600);
  }

  async acquireLock() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
    const lock = {
      schemaVersion: 1,
      pid: process.pid,
      hostname: os.hostname(),
      startedAt: new Date().toISOString(),
    };

    try {
      const handle = await open(this.lockPath, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(lock, null, 2)}\n`);
      await handle.close();
      return lock;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }

    let existingLock = null;
    try {
      existingLock = JSON.parse(await readFile(this.lockPath, 'utf8'));
    } catch {
      existingLock = null;
    }

    if (existingLock?.hostname === os.hostname() && Number.isInteger(existingLock.pid)) {
      try {
        process.kill(existingLock.pid, 0);
        throw new Error(`Another installer process is active with PID ${existingLock.pid}`);
      } catch (error) {
        if (!['ESRCH', 'EPERM'].includes(error.code)) throw error;
        if (error.code === 'EPERM') throw new Error(`Another installer process may be active with PID ${existingLock.pid}`);
      }
    }

    await this.archiveLock(existingLock ? 'stale' : 'invalid');
    return await this.acquireLock();
  }

  async releaseLock(lock) {
    let existingLock;
    try {
      existingLock = JSON.parse(await readFile(this.lockPath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    if (existingLock.pid !== lock.pid || existingLock.startedAt !== lock.startedAt) {
      throw new Error('Installer lock ownership changed unexpectedly');
    }
    await this.archiveLock('completed');
  }

  async archiveLock(reason) {
    await mkdir(this.lockHistoryDirectory, { recursive: true, mode: 0o700 });
    const timestamp = new Date().toISOString().replaceAll(':', '-');
    const destination = path.join(this.lockHistoryDirectory, `${timestamp}-${reason}-${process.pid}.json`);
    try {
      await rename(this.lockPath, destination);
      await chmod(destination, 0o600);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

export function newState(config, fingerprint, steps, now = new Date()) {
  const timestamp = now.toISOString();
  return {
    schemaVersion: 1,
    installationId: config.installationId,
    configFingerprint: fingerprint,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    lastError: null,
    steps: Object.fromEntries(steps.map((step) => [step.id, {
      status: 'pending',
      attempts: 0,
      updatedAt: timestamp,
    }])),
  };
}
