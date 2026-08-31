import { loadConfig } from './config.js';
import { applyCommand, defaultStateRoot, planCommand, verifyCommand } from './commands.js';
import { loadHetznerCredential, loadOpenRouterCredential } from './credentials.js';
import { initializeInstallation } from './initialize.js';
import { connectHetznerCommand } from './onboarding.js';
import { connectOpenRouterCommand } from './openrouter-onboarding.js';
import { createBrainRepositoryCommand } from './brain-repository.js';
import { redact } from './redact.js';

function usage() {
  return `Usage:
  brain4u-installer init [--installation-id <id>] [--state-dir <path>] [--json]
  brain4u-installer plan --config <path> [--state-dir <path>] [--json]
  brain4u-installer apply --config <path> [--approve-infrastructure <code>] [--state-dir <path>] [--json]
  brain4u-installer resume --config <path> [--approve-infrastructure <code>] [--state-dir <path>] [--json]
  brain4u-installer verify --config <path> [--smoke-inference] [--json]
  brain4u-installer connect-openrouter --config <path> [--state-dir <path>] [--json]
  brain4u-installer connect-hetzner --config <path> [--state-dir <path>] [--json]
  brain4u-installer create-brain --config <path> [--json]
`;
}

function parseArgs(argv) {
  const command = argv[0];
  const options = { command, json: false, smokeInference: false };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') options.json = true;
    else if (argument === '--smoke-inference') options.smokeInference = true;
    else if (argument === '--config') options.configPath = argv[++index];
    else if (argument === '--state-dir') options.stateRoot = argv[++index];
    else if (argument === '--installation-id') options.installationId = argv[++index];
    else if (argument === '--approve-infrastructure') options.infrastructureApproval = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!['init', 'plan', 'apply', 'resume', 'verify', 'connect-openrouter', 'connect-hetzner', 'create-brain'].includes(command)) throw new Error(usage());
  if (command !== 'init' && !options.configPath) throw new Error('--config is required');
  options.stateRoot ??= defaultStateRoot();
  return options;
}

function renderHuman(result) {
  if (result.command === 'init') {
    return [
      `Local preparation completed for ${result.installationId}`,
      `Configuration: ${result.configPath}`,
      `SSH key fingerprint: ${result.sshKeyFingerprint}`,
      'No remote changes were made.',
    ].join('\n');
  }
  if (result.command === 'plan') {
    const lines = result.steps.map((step) => `${step.applied ? 'OK' : 'PENDING'} ${step.id}: ${step.description}`);
    const infrastructure = result.infrastructure;
    const infrastructureLines = infrastructure ? [
      `Hetzner: ${infrastructure.desired.serverType} in ${infrastructure.desired.location}`,
      `Price: ${infrastructure.desired.priceMonthlyGross} ${infrastructure.desired.currency}/month`,
      `Infrastructure actions: ${infrastructure.actions.length ? infrastructure.actions.join(', ') : 'none'}`,
      ...(infrastructure.approvalCode ? [`Approval code: ${infrastructure.approvalCode}`] : []),
    ] : [];
    if (result.installationBlockedUntilProvisioned) lines.push('BLOCKED remote installation waits for VPS provisioning');
    return [`Plan for ${result.installationId}`, ...infrastructureLines, ...lines, 'No changes were made.'].join('\n');
  }
  if (result.command === 'verify') {
    return result.ok
      ? `Verification passed for ${result.installationId}`
      : `Verification failed: ${result.failures.join(', ')}`;
  }
  if (result.command === 'connect-hetzner') {
    return result.alreadyConnected
      ? `Hetzner is already connected for ${result.installationId}`
      : `Hetzner connected for ${result.installationId}. Return to Claude Code to review the VPS plan.`;
  }
  if (result.command === 'connect-openrouter') {
    return result.alreadyConnected
      ? `OpenRouter is already connected for ${result.installationId}`
      : `OpenRouter connected for ${result.installationId}. Return to Claude Code to connect Hetzner.`;
  }
  if (result.command === 'create-brain') {
    return result.alreadyExisted
      ? `Brain repository and runtime access verified: ${result.url}`
      : `Private Brain repository and runtime access created: ${result.url}`;
  }
  return `Installation ${result.status}: ${result.completedSteps.length} steps completed`;
}

export async function main(argv) {
  let options;
  let providerSecret;
  let infrastructureSecret;
  try {
    options = parseArgs(argv);
    if (options.command === 'init') {
      const result = await initializeInstallation({
        stateRoot: options.stateRoot,
        installationId: options.installationId,
      });
      process.stdout.write(`${options.json ? JSON.stringify(result, null, 2) : renderHuman(result)}\n`);
      return;
    }
    const loaded = await loadConfig(options.configPath);
    if (options.command === 'create-brain') {
      const result = await createBrainRepositoryCommand({ config: loaded.config, configPath: loaded.configPath });
      process.stdout.write(`${options.json ? JSON.stringify(result, null, 2) : renderHuman(result)}\n`);
      return;
    }
    if (!process.env[loaded.config.provider.keyEnv]) {
      const storedCredential = await loadOpenRouterCredential(options.stateRoot, loaded.config.installationId);
      if (storedCredential) process.env[loaded.config.provider.keyEnv] = storedCredential;
    }
    providerSecret = process.env[loaded.config.provider.keyEnv];
    if (loaded.config.infrastructure && !process.env[loaded.config.infrastructure.tokenEnv]) {
      const storedCredential = await loadHetznerCredential(options.stateRoot, loaded.config.installationId);
      if (storedCredential) process.env[loaded.config.infrastructure.tokenEnv] = storedCredential;
    }
    infrastructureSecret = loaded.config.infrastructure
      ? process.env[loaded.config.infrastructure.tokenEnv]
      : null;
    const input = {
      ...loaded,
      stateRoot: options.stateRoot,
      infrastructureApproval: options.infrastructureApproval,
    };
    let result;
    if (options.command === 'connect-openrouter') result = await connectOpenRouterCommand(input);
    else if (options.command === 'connect-hetzner') result = await connectHetznerCommand(input);
    else if (options.command === 'plan') result = await planCommand(input);
    else if (options.command === 'apply') result = await applyCommand({ ...input, onEvent: progressEvent });
    else if (options.command === 'resume') result = await applyCommand({ ...input, resume: true, onEvent: progressEvent });
    else result = await verifyCommand({ ...input, smokeInference: options.smokeInference });

    process.stdout.write(`${options.json ? JSON.stringify(result, null, 2) : renderHuman(result)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    const detail = error.result?.stderr?.trim() || error.message;
    const message = redact(detail, [providerSecret, infrastructureSecret]);
    process.stderr.write(`${JSON.stringify({ ok: false, error: { message } }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

function progressEvent(event) {
  if (event.type === 'infrastructure_started') process.stderr.write(`INFRA START ${event.action}\n`);
  if (event.type === 'infrastructure_completed') process.stderr.write(`INFRA DONE ${event.action}\n`);
  if (event.type === 'step_started') process.stderr.write(`START ${event.step}\n`);
  if (event.type === 'step_completed') process.stderr.write(`DONE ${event.step}\n`);
  if (event.type === 'step_skipped') process.stderr.write(`SKIP ${event.step}\n`);
  if (event.type === 'step_failed') process.stderr.write(`FAIL ${event.step}: ${event.message}\n`);
}
