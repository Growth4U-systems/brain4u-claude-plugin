import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSsh, uploadText } from './remote.js';
import { PERSISTENCE_CANARY, PERSISTENCE_CANARY_SHA256, renderCompose, renderHermesConfig } from './templates.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const vpsDirectory = path.resolve(currentDirectory, '../../vps');

async function script(name) {
  return await readFile(path.join(vpsDirectory, name), 'utf8');
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function commandSucceeds(config, command) {
  try {
    await runSsh(config, command, { timeoutMs: 30_000 });
    return true;
  } catch {
    return false;
  }
}

export function buildInstallSteps(config) {
  const compose = renderCompose(config);
  const hermesConfig = renderHermesConfig(config);
  const composeHash = sha256(compose);
  const configHash = sha256(hermesConfig);
  const brainCoreCheck = config.brain?.sshUrl
    ? `; test -f /opt/brain4u/brain/.brain4u-template-version; test "$(git -c safe.directory=/opt/brain4u/brain -C /opt/brain4u/brain remote get-url origin)" = ${config.brain.sshUrl}; test "$(docker inspect brain4u-hermes-spike --format '{{.Config.WorkingDir}}')" = /opt/brain; systemctl is-active --quiet brain4u-sync.timer; docker exec --user hermes brain4u-hermes-spike sh -c 'test -r /opt/brain/INDEX.md && test -w /opt/brain && test -r /opt/brain4u-ssh/brain-deploy-key'`
    : '';

  return [
    {
      id: 'remote_preflight',
      description: 'Validate the remote Ubuntu host',
      check: async () => await commandSucceeds(config, "test \"$(. /etc/os-release; printf %s \"$ID:$VERSION_ID\")\" = ubuntu:24.04 && test \"$(uname -m)\" = x86_64 && cloud-init status 2>/dev/null | grep -q 'status: done'"),
      run: async () => {
        let lastError;
        for (let attempt = 0; attempt < 60; attempt += 1) {
          try {
            await runSsh(config, "timeout 300 cloud-init status --wait >/dev/null && test \"$(. /etc/os-release; printf %s \"$ID:$VERSION_ID\")\" = ubuntu:24.04 && test \"$(uname -m)\" = x86_64");
            return;
          } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 5_000));
          }
        }
        throw lastError ?? new Error('Remote host did not become ready');
      },
    },
    {
      id: 'docker_runtime',
      description: 'Install and start Docker Engine',
      check: async () => await commandSucceeds(config, 'command -v docker >/dev/null && command -v git >/dev/null && command -v jq >/dev/null && command -v ssh-keyscan >/dev/null && systemctl is-active --quiet docker && docker compose version >/dev/null'),
      run: async () => {
        await runSsh(config, 'bash -s', { input: await script('bootstrap-docker.sh') });
      },
    },
    ...(config.brain?.sshUrl ? [{
      id: 'brain_checkout',
      description: 'Connect the private Brain repository to the VPS',
      check: async () => {
        const deployKey = await readFile(config.brain.deployKeyFile);
        const deployKeyHash = sha256(deployKey);
        return await commandSucceeds(config, `set -e; test "$(sha256sum /opt/brain4u/secrets/ssh/brain-deploy-key 2>/dev/null | awk '{print $1}')" = ${deployKeyHash}; test -f /opt/brain4u/secrets/ssh/known_hosts; test -f /opt/brain4u/brain/.brain4u-template-version; test "$(git -c safe.directory=/opt/brain4u/brain -C /opt/brain4u/brain remote get-url origin)" = ${config.brain.sshUrl}; GIT_SSH_COMMAND='ssh -i /opt/brain4u/secrets/ssh/brain-deploy-key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/opt/brain4u/secrets/ssh/known_hosts' git -c safe.directory=/opt/brain4u/brain -C /opt/brain4u/brain ls-remote origin HEAD >/dev/null`);
      },
      run: async () => {
        const deployKey = await readFile(config.brain.deployKeyFile, 'utf8');
        await runSsh(config, 'install -d -m 0700 /opt/brain4u/secrets/ssh');
        await uploadText(config, '/opt/brain4u/secrets/ssh/brain-deploy-key', deployKey, '0600');
        const remoteCommand = `set -Eeuo pipefail
install -d -m 0700 /opt/brain4u/secrets/ssh
known_hosts_tmp=/opt/brain4u/secrets/ssh/known_hosts.tmp
ssh-keyscan -t ed25519 github.com >"$known_hosts_tmp" 2>/dev/null
chmod 0600 "$known_hosts_tmp"
mv "$known_hosts_tmp" /opt/brain4u/secrets/ssh/known_hosts
export GIT_SSH_COMMAND='ssh -i /opt/brain4u/secrets/ssh/brain-deploy-key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/opt/brain4u/secrets/ssh/known_hosts'
if [[ -e /opt/brain4u/brain && ! -d /opt/brain4u/brain/.git ]]; then
  printf 'Existing /opt/brain4u/brain is not a Git repository; it was not modified.\n' >&2
  exit 1
fi
if [[ ! -d /opt/brain4u/brain/.git ]]; then
  git clone --branch main --single-branch ${config.brain.sshUrl} /opt/brain4u/brain
fi
test -f /opt/brain4u/brain/.brain4u-template-version
test "$(git -c safe.directory=/opt/brain4u/brain -C /opt/brain4u/brain remote get-url origin)" = ${config.brain.sshUrl}
git -c safe.directory=/opt/brain4u/brain -C /opt/brain4u/brain config user.name Brain4U
git -c safe.directory=/opt/brain4u/brain -C /opt/brain4u/brain config user.email brain4u@users.noreply.github.com
git -c safe.directory=/opt/brain4u/brain -C /opt/brain4u/brain ls-remote origin HEAD >/dev/null
`;
        await runSsh(config, 'bash -s', { input: remoteCommand, timeoutMs: 120_000 });
      },
    }] : []),
    {
      id: 'hermes_files',
      description: 'Install pinned Hermes configuration',
      check: async () => await commandSucceeds(config, `test \"$(sha256sum /opt/brain4u/hermes/compose.yaml 2>/dev/null | awk '{print $1}')\" = ${composeHash} && test \"$(sha256sum /opt/brain4u/hermes/data/config.yaml 2>/dev/null | awk '{print $1}')\" = ${configHash}`),
      run: async () => {
        await uploadText(config, '/opt/brain4u/hermes/compose.yaml', compose, '0644');
        await uploadText(config, '/opt/brain4u/hermes/data/config.yaml', hermesConfig, '0600');
      },
    },
    {
      id: 'provider_secret',
      description: 'Transfer the provider key from private local storage',
      check: async () => await commandSucceeds(config, "test -s /opt/brain4u/hermes/data/.env && grep -q '^OPENROUTER_API_KEY=.' /opt/brain4u/hermes/data/.env"),
      run: async () => {
        const providerKey = process.env[config.provider.keyEnv];
        if (!providerKey) throw new Error(`${config.provider.keyEnv} is required because the VPS has no provider key`);
        const remoteCommand = `set -e
install -d -m 0700 /opt/brain4u/hermes/data
umask 077
touch /opt/brain4u/hermes/data/.env
chmod 0600 /opt/brain4u/hermes/data/.env
if ! grep -q '^OPENROUTER_API_KEY=.' /opt/brain4u/hermes/data/.env; then
  IFS= read -r provider_key
  printf 'OPENROUTER_API_KEY=%s\\n' "$provider_key" >>/opt/brain4u/hermes/data/.env
fi
grep -q '^API_SERVER_ENABLED=' /opt/brain4u/hermes/data/.env || printf 'API_SERVER_ENABLED=true\\n' >>/opt/brain4u/hermes/data/.env
grep -q '^API_SERVER_HOST=' /opt/brain4u/hermes/data/.env || printf 'API_SERVER_HOST=0.0.0.0\\n' >>/opt/brain4u/hermes/data/.env
`;
        await runSsh(config, remoteCommand, { input: `${providerKey}\n` });
      },
    },
    {
      id: 'hermes_service',
      description: 'Start Hermes and wait for health',
      check: async () => await commandSucceeds(config, `set -e; test \"$(docker inspect brain4u-hermes-spike --format '{{.State.Status}}' 2>/dev/null)\" = running; test \"$(docker inspect brain4u-hermes-spike --format '{{.Config.Image}}' 2>/dev/null)\" = ${config.hermes.image}; curl -fsS --max-time 3 http://127.0.0.1:8642/health >/dev/null${brainCoreCheck}`),
      run: async () => {
        if (config.brain?.sshUrl) {
          await uploadText(config, '/opt/brain4u/sync-brain.sh', await script('sync-brain.sh'), '0755');
        }
        await runSsh(config, 'bash -s', { input: await script('deploy-hermes.sh') });
        for (let attempt = 0; attempt < 10; attempt += 1) {
          if (await commandSucceeds(config, 'curl -fsS --max-time 3 http://127.0.0.1:8642/health >/dev/null')) return;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
        throw new Error('Hermes did not become healthy');
      },
    },
    {
      id: 'persistence_canary',
      description: 'Create the persistence verification canary',
      check: async () => await commandSucceeds(config, `test \"$(sha256sum /opt/brain4u/hermes/data/verification/persistence-canary.txt 2>/dev/null | awk '{print $1}')\" = ${PERSISTENCE_CANARY_SHA256}`),
      run: async () => {
        await runSsh(config, "install -d -m 0700 /opt/brain4u/hermes/data/verification && tee /opt/brain4u/hermes/data/verification/persistence-canary.txt >/dev/null", { input: PERSISTENCE_CANARY });
      },
    },
    {
      id: 'core_verify',
      description: 'Verify Brain connection, health, persistence and secret hygiene',
      check: async () => await commandSucceeds(config, `set -e; curl -fsS --max-time 3 http://127.0.0.1:8642/health >/dev/null; test \"$(stat -c %a /opt/brain4u/hermes/data/.env)\" = 600; test \"$(sha256sum /opt/brain4u/hermes/data/verification/persistence-canary.txt | awk '{print $1}')\" = ${PERSISTENCE_CANARY_SHA256}; provider_key=\"$(sed -n 's/^OPENROUTER_API_KEY=//p' /opt/brain4u/hermes/data/.env)\"; ! docker logs brain4u-hermes-spike 2>&1 | grep -Fq \"$provider_key\"${brainCoreCheck}`),
      run: async () => {
        if (!(await commandSucceeds(config, `set -e; curl -fsS --max-time 3 http://127.0.0.1:8642/health >/dev/null; test \"$(stat -c %a /opt/brain4u/hermes/data/.env)\" = 600; test \"$(sha256sum /opt/brain4u/hermes/data/verification/persistence-canary.txt | awk '{print $1}')\" = ${PERSISTENCE_CANARY_SHA256}; provider_key=\"$(sed -n 's/^OPENROUTER_API_KEY=//p' /opt/brain4u/hermes/data/.env)\"; ! docker logs brain4u-hermes-spike 2>&1 | grep -Fq \"$provider_key\"${brainCoreCheck}`))) {
          throw new Error('Core verification failed');
        }
      },
    },
  ];
}
