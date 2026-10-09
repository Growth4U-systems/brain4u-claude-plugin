import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { runSteps } from './core.js';
import { applyInfrastructure, planInfrastructure, withResolvedTarget } from './infrastructure.js';
import { buildInstallSteps } from './install-steps.js';
import { isTcpPortOpen, runSsh } from './remote.js';
import { newState, StateStore } from './state-store.js';

export function defaultStateRoot() {
  return path.join(os.homedir(), '.brain4u-installer');
}

export function isSuccessfulSmoke(smoke) {
  return smoke?.error == null
    && smoke?.finish_reason === 'stop'
    && typeof smoke?.content === 'string'
    && smoke.content.includes('BRAIN4U_OK');
}

function assertBrainResolved(config) {
  if (config.brain && (!config.brain.owner || !config.brain.sshUrl)) {
    throw new Error('Brain repository is not initialized; run create-brain before continuing');
  }
}

export async function planCommand({ config, fingerprint, stateRoot, steps, infrastructureClient }) {
  assertBrainResolved(config);
  const stateStore = new StateStore(stateRoot, config.installationId);
  const state = await stateStore.load();
  const remote = [];
  let infrastructure = null;
  let resolvedConfig = config;

  if (config.infrastructure) {
    infrastructure = await planInfrastructure({ config, client: infrastructureClient });
    if (infrastructure.resolvedHost) {
      resolvedConfig = withResolvedTarget(config, infrastructure.resolvedHost);
    }
  }

  const installSteps = steps ?? (resolvedConfig.target.host ? buildInstallSteps(resolvedConfig) : []);

  for (const step of installSteps) {
    let applied = false;
    try {
      applied = await step.check();
    } catch {
      applied = false;
    }
    remote.push({ id: step.id, description: step.description, applied });
  }

  return {
    ok: true,
    command: 'plan',
    installationId: config.installationId,
    configFingerprint: fingerprint,
    target: resolvedConfig.target.host ? `${resolvedConfig.target.user}@${resolvedConfig.target.host}` : null,
    infrastructure,
    installationBlockedUntilProvisioned: Boolean(config.infrastructure && !infrastructure.resolvedHost),
    state: state ? { status: state.status, path: stateStore.path } : null,
    providerKeyAvailableLocally: Boolean(process.env[config.provider.keyEnv]),
    steps: remote,
    mutationsPerformed: false,
  };
}

export async function applyCommand({ config, fingerprint, stateRoot, resume = false, onEvent, infrastructureApproval, infrastructureClient }) {
  assertBrainResolved(config);
  const stateStore = new StateStore(stateRoot, config.installationId);
  const lock = await stateStore.acquireLock();
  try {
    const existingState = await stateStore.load();
    if (resume && !existingState) throw new Error('No installation state exists to resume');
    if (existingState && existingState.configFingerprint !== fingerprint) {
      throw new Error('Configuration changed after installation state was created');
    }
    if (config.infrastructure && !existingState) {
      await stateStore.save(newState(config, fingerprint, buildInstallSteps(config)));
    }

    let resolvedConfig = config;
    let infrastructure = null;
    if (config.infrastructure) {
      infrastructure = await applyInfrastructure({
        config,
        approval: infrastructureApproval,
        client: infrastructureClient,
        onEvent,
      });
      resolvedConfig = withResolvedTarget(config, infrastructure.resolvedHost);
      await stateStore.saveInfrastructure({
        schemaVersion: 1,
        installationId: config.installationId,
        provider: 'hetzner',
        updatedAt: new Date().toISOString(),
        desired: infrastructure.desired,
        resources: infrastructure.existing,
        resolvedHost: infrastructure.resolvedHost,
      });
    }
    const steps = buildInstallSteps(resolvedConfig);
    const state = await runSteps({
      config: resolvedConfig,
      fingerprint,
      stateStore,
      steps,
      requireExisting: resume,
      onEvent,
    });
    return {
      ok: true,
      command: resume ? 'resume' : 'apply',
      installationId: config.installationId,
      status: state.status,
      statePath: stateStore.path,
      completedSteps: Object.entries(state.steps).filter(([, value]) => value.status === 'completed').map(([id]) => id),
      infrastructure: infrastructure ? {
        provider: 'hetzner',
        server: infrastructure.existing.server,
        mutationsPerformed: infrastructure.mutationsPerformed,
      } : null,
    };
  } finally {
    await stateStore.releaseLock(lock);
  }
}

function parseKeyValueLines(output) {
  return Object.fromEntries(output.trim().split('\n').filter(Boolean).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

export async function verifyCommand({
  config,
  smokeInference = false,
  infrastructureClient,
  infrastructurePlan = planInfrastructure,
  runSshImpl = runSsh,
  isTcpPortOpenImpl = isTcpPortOpen,
  verificationAttempts = 5,
  waitImpl = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  assertBrainResolved(config);
  let resolvedConfig = config;
  if (config.infrastructure) {
    const infrastructure = await infrastructurePlan({ config, client: infrastructureClient });
    if (infrastructure.actions.length) {
      throw new Error(`Infrastructure is not reconciled: ${infrastructure.actions.join(', ')}`);
    }
    if (!infrastructure.resolvedHost) throw new Error('Managed infrastructure has no resolved host');
    resolvedConfig = withResolvedTarget(config, infrastructure.resolvedHost);
  }
  const remoteCommand = `set -e
printf 'docker=%s\\n' "$(systemctl is-active docker)"
printf 'container=%s\\n' "$(docker inspect brain4u-hermes-spike --format '{{.State.Status}}')"
printf 'image=%s\\n' "$(docker inspect brain4u-hermes-spike --format '{{.Config.Image}}')"
printf 'env_mode=%s\\n' "$(stat -c %a /opt/brain4u/hermes/data/.env)"
printf 'canary=%s\\n' "$(sha256sum /opt/brain4u/hermes/data/verification/persistence-canary.txt | awk '{print $1}')"
printf 'health=%s\\n' "$(curl -fsS --max-time 3 http://127.0.0.1:8642/health | jq -c .)"
${resolvedConfig.brain?.sshUrl ? `printf 'brain_marker=%s\\n' "$(test -f /opt/brain4u/brain/.brain4u-template-version && printf present || printf missing)"
printf 'brain_origin=%s\\n' "$(git -c safe.directory=/opt/brain4u/brain -C /opt/brain4u/brain remote get-url origin 2>/dev/null || true)"
printf 'brain_workdir=%s\\n' "$(docker inspect brain4u-hermes-spike --format '{{.Config.WorkingDir}}')"
printf 'brain_mounted=%s\\n' "$(docker exec brain4u-hermes-spike sh -c 'test -f /opt/brain/INDEX.md && printf true || printf false')"
printf 'brain_runtime_access=%s\\n' "$(docker exec --user hermes brain4u-hermes-spike sh -c 'test -r /opt/brain/INDEX.md && test -w /opt/brain && test -r /opt/brain4u-ssh/brain-deploy-key && printf true || printf false')"
printf 'brain_sync=%s\\n' "$(systemctl is-active brain4u-sync.timer 2>/dev/null || true)"
` : ''}provider_key="$(sed -n 's/^OPENROUTER_API_KEY=//p' /opt/brain4u/hermes/data/.env)"
if docker logs brain4u-hermes-spike 2>&1 | grep -Fq "$provider_key"; then printf 'secret_in_logs=true\\n'; else printf 'secret_in_logs=false\\n'; fi
unset provider_key
`;
  let result;
  let lastProbeError;
  for (let attempt = 1; attempt <= verificationAttempts; attempt += 1) {
    try {
      result = await runSshImpl(resolvedConfig, 'bash -s', { input: remoteCommand, timeoutMs: 30_000 });
      break;
    } catch (error) {
      lastProbeError = error;
      if (attempt < verificationAttempts) await waitImpl(2_000);
    }
  }
  if (!result) throw lastProbeError ?? new Error('Remote verification probe failed');
  const checks = parseKeyValueLines(result.stdout);
  const publicPortOpen = await isTcpPortOpenImpl(resolvedConfig.target.host, 8642);
  const expectedCanary = '78d000b3297402588017b17f28ddaafd23884a6c76f53ad75361f9a7191b897a';
  const failures = [];
  if (checks.docker !== 'active') failures.push('docker_not_active');
  if (checks.container !== 'running') failures.push('hermes_not_running');
  if (checks.image !== resolvedConfig.hermes.image) failures.push('image_drift');
  if (checks.env_mode !== '600') failures.push('secret_permissions');
  if (checks.canary !== expectedCanary) failures.push('persistence_canary');
  if (checks.secret_in_logs !== 'false') failures.push('secret_in_logs');
  if (publicPortOpen) failures.push('public_gateway_port');
  if (resolvedConfig.brain?.sshUrl) {
    if (checks.brain_marker !== 'present') failures.push('brain_marker');
    if (checks.brain_origin !== resolvedConfig.brain.sshUrl) failures.push('brain_origin');
    if (checks.brain_workdir !== '/opt/brain') failures.push('brain_workdir');
    if (checks.brain_mounted !== 'true') failures.push('brain_mount');
    if (checks.brain_runtime_access !== 'true') failures.push('brain_runtime_permissions');
    if (checks.brain_sync !== 'active') failures.push('brain_sync_timer');
  }

  let smoke = null;
  if (smokeInference) {
    const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
    const smokeScript = await readFile(path.resolve(currentDirectory, '../../vps/smoke-hermes.sh'), 'utf8');
    const smokeResult = await runSshImpl(resolvedConfig, 'bash -s', { input: smokeScript, timeoutMs: 150_000 });
    smoke = JSON.parse(smokeResult.stdout);
    if (!isSuccessfulSmoke(smoke)) failures.push('inference_smoke');
  }

  return {
    ok: failures.length === 0,
    command: 'verify',
    installationId: config.installationId,
    checks: {
      dockerActive: checks.docker === 'active',
      hermesRunning: checks.container === 'running',
      pinnedImage: checks.image === config.hermes.image,
      secretFileMode: checks.env_mode,
      persistenceCanary: checks.canary === expectedCanary,
      secretInLogs: checks.secret_in_logs === 'true',
      publicGatewayPortOpen: publicPortOpen,
      health: JSON.parse(checks.health),
      brainRepository: resolvedConfig.brain?.sshUrl ? {
        markerPresent: checks.brain_marker === 'present',
        origin: checks.brain_origin,
        mountedInHermes: checks.brain_mounted === 'true',
        runtimeCanReadAndWrite: checks.brain_runtime_access === 'true',
        automaticSyncActive: checks.brain_sync === 'active',
        hermesWorkingDirectory: checks.brain_workdir,
      } : null,
    },
    smokeInference: smoke,
    failures,
  };
}
