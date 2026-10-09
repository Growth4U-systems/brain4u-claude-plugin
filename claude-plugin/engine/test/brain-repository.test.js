import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createBrainRepositoryCommand } from '../src/brain-repository.js';
import { runProcess } from '../src/process.js';

async function makeTemplate() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-template-test-'));
  const files = {
    '.brain4u-template-version': '1\n',
    'README.md': '# Brain4U\n',
    'CLAUDE.md': '# Rules\n',
    'AGENTS.md': '# Agents\n',
    'INDEX.md': '# Index\n',
    'gbrain.yml': 'storage: {}\n',
    'governance/memory-writeback-policy.md': '# Policy\n',
    'wiki/README.md': '# Wiki\n',
    'skills/brain-read/SKILL.md': '# Read\n',
    'skills/brain-write/SKILL.md': '# Write\n',
    '.github/CODEOWNERS': '/governance/ @OWNER\n',
  };
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

async function makeConfig() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-config-test-'));
  const configPath = path.join(root, 'config.json');
  const config = {
    installationId: 'brain4u-test',
    brain: {
      repositoryName: 'brain4u',
      visibility: 'private',
      deployKeyFile: path.join(root, 'credentials', 'brain-deploy-key'),
    },
  };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return { config, configPath };
}

async function mockSshKeygen(args) {
  const outputPath = args[args.indexOf('-f') + 1];
  if (args.includes('-y')) return { stdout: 'ssh-ed25519 AAAATESTKEY\n', stderr: '' };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, 'PRIVATE TEST KEY\n', { mode: 0o600 });
  await writeFile(`${outputPath}.pub`, 'ssh-ed25519 AAAATESTKEY brain4u-runtime\n', { mode: 0o644 });
  return { stdout: '', stderr: '' };
}

function missingRepositoryError() {
  const error = new Error('gh exited with code 1');
  error.result = { stderr: 'GraphQL: Could not resolve to a Repository' };
  return error;
}

test('creates and verifies a private Brain repository from the packaged template', async () => {
  const templatePath = await makeTemplate();
  const { config, configPath } = await makeConfig();
  const calls = [];
  let repositoryCreated = false;
  const result = await createBrainRepositoryCommand({
    config,
    configPath,
    templatePath,
    runProcessImpl: async (command, args) => {
      calls.push([command, ...args]);
      if (command === 'gh' && args[0] === 'auth') return { stdout: '', stderr: '' };
      if (command === 'gh' && args[0] === 'api' && args[1] === 'user') return { stdout: 'octocat\n', stderr: '' };
      if (command === 'gh' && args[0] === 'repo' && args[1] === 'view') {
        if (!repositoryCreated) throw missingRepositoryError();
        return { stdout: JSON.stringify({ nameWithOwner: 'octocat/brain4u', url: 'https://github.com/octocat/brain4u', visibility: 'PRIVATE', defaultBranchRef: { name: 'main' } }), stderr: '' };
      }
      if (command === 'gh' && args[0] === 'repo' && args[1] === 'create') {
        const source = args[args.indexOf('--source') + 1];
        assert.equal((await readFile(path.join(source, '.brain4u-template-version'), 'utf8')).trim(), '1');
        assert.equal((await readFile(path.join(source, '.github', 'CODEOWNERS'), 'utf8')).trim(), '/governance/ @octocat');
        repositoryCreated = true;
        return { stdout: 'https://github.com/octocat/brain4u\n', stderr: '' };
      }
      if (command === 'gh' && args[0] === 'api' && args[1].includes('.brain4u-template-version')) {
        return { stdout: '.brain4u-template-version\n', stderr: '' };
      }
      if (command === 'gh' && args[0] === 'api' && args[1] === 'repos/octocat/brain4u/keys') {
        return { stdout: '', stderr: '' };
      }
      if (command === 'gh' && args[0] === 'api' && args[1] === '--method') {
        return { stdout: JSON.stringify({ id: 1 }), stderr: '' };
      }
      if (command === 'git') return { stdout: '', stderr: '' };
      if (command === 'ssh-keygen') return await mockSshKeygen(args);
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.repository, 'octocat/brain4u');
  assert.equal(result.visibility, 'private');
  assert.equal(result.defaultBranch, 'main');
  assert.equal(result.alreadyExisted, false);
  assert.equal(result.sshUrl, 'git@github.com:octocat/brain4u.git');
  assert.equal(result.deployKeyRegistered, true);
  const persisted = JSON.parse(await readFile(configPath, 'utf8'));
  assert.equal(persisted.brain.owner, 'octocat');
  assert.equal(persisted.brain.sshUrl, 'git@github.com:octocat/brain4u.git');
  assert.equal(calls.some((call) => call[0] === 'gh' && call[1] === 'repo' && call[2] === 'create'), true);
});

test('reuses an existing private repository only when it has the Brain marker', async () => {
  const templatePath = await makeTemplate();
  const { config, configPath } = await makeConfig();
  const result = await createBrainRepositoryCommand({
    config,
    configPath,
    templatePath,
    runProcessImpl: async (command, args) => {
      if (command === 'gh' && args[0] === 'auth') return { stdout: '', stderr: '' };
      if (command === 'gh' && args[0] === 'api' && args[1] === 'user') return { stdout: 'octocat\n', stderr: '' };
      if (command === 'gh' && args[0] === 'repo') return { stdout: JSON.stringify({ url: 'https://github.com/octocat/brain4u', visibility: 'PRIVATE', defaultBranchRef: { name: 'main' } }), stderr: '' };
      if (command === 'gh' && args[0] === 'api' && args[1].includes('.brain4u-template-version')) return { stdout: '.brain4u-template-version\n', stderr: '' };
      if (command === 'gh' && args[0] === 'api' && args[1] === 'repos/octocat/brain4u/keys') return { stdout: '', stderr: '' };
      if (command === 'gh' && args[0] === 'api' && args[1] === '--method') return { stdout: JSON.stringify({ id: 1 }), stderr: '' };
      if (command === 'ssh-keygen') return await mockSshKeygen(args);
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    },
  });
  assert.equal(result.alreadyExisted, true);
  assert.equal(result.deployKeyRegistered, true);
});

test('brain-only works for an external owner without creating or granting runtime credentials', async () => {
  const templatePath = await makeTemplate();
  const { config, configPath } = await makeConfig();
  const calls = [];
  const result = await createBrainRepositoryCommand({
    config, configPath, templatePath, connectRuntime: false,
    runProcessImpl: async (command, args) => {
      calls.push([command, ...args]);
      if (command !== 'gh') throw new Error('Unexpected runtime command');
      if (args[0] === 'auth') return { stdout: '', stderr: '' };
      if (args[0] === 'api' && args[1] === 'user') return { stdout: 'outside-owner\n', stderr: '' };
      if (args[0] === 'repo') return { stdout: JSON.stringify({ url: 'https://github.com/outside-owner/brain4u', visibility: 'PRIVATE', defaultBranchRef: { name: 'main' } }), stderr: '' };
      if (args[0] === 'api' && args[1] === 'repos/outside-owner/brain4u/contents/.brain4u-template-version') return { stdout: '.brain4u-template-version\n', stderr: '' };
      throw new Error('Unexpected GitHub credential mutation');
    },
  });
  assert.equal(result.repository, 'outside-owner/brain4u');
  assert.equal(result.runtimeAccessConfigured, false);
  assert.equal(result.deployKeyRegistered, false);
  assert.equal(result.deployKeyCreated, false);
  assert.ok(calls.every(call => !call.join(' ').includes('Growth4U-systems')));
});

test('builds the template as a real clean Git repository before publication', async () => {
  const templatePath = await makeTemplate();
  const { config, configPath } = await makeConfig();
  let repositoryCreated = false;
  const result = await createBrainRepositoryCommand({
    config,
    configPath,
    templatePath,
    runProcessImpl: async (command, args, options) => {
      if (command === 'git' || command === 'ssh-keygen') return await runProcess(command, args, options);
      if (command === 'gh' && args[0] === 'auth') return { stdout: '', stderr: '' };
      if (command === 'gh' && args[0] === 'api' && args[1] === 'user') return { stdout: 'octocat\n', stderr: '' };
      if (command === 'gh' && args[0] === 'repo' && args[1] === 'view') {
        if (!repositoryCreated) throw missingRepositoryError();
        return { stdout: JSON.stringify({ url: 'https://github.com/octocat/brain4u', visibility: 'PRIVATE', defaultBranchRef: { name: 'main' } }), stderr: '' };
      }
      if (command === 'gh' && args[0] === 'repo' && args[1] === 'create') {
        const source = args[args.indexOf('--source') + 1];
        const head = await runProcess('git', ['-C', source, 'rev-parse', '--verify', 'HEAD']);
        const status = await runProcess('git', ['-C', source, 'status', '--porcelain']);
        assert.match(head.stdout.trim(), /^[a-f0-9]{40}$/);
        assert.equal(status.stdout, '');
        repositoryCreated = true;
        return { stdout: '', stderr: '' };
      }
      if (command === 'gh' && args[0] === 'api' && args[1].includes('.brain4u-template-version')) return { stdout: '.brain4u-template-version\n', stderr: '' };
      if (command === 'gh' && args[0] === 'api' && args[1] === 'repos/octocat/brain4u/keys') return { stdout: '', stderr: '' };
      if (command === 'gh' && args[0] === 'api' && args[1] === '--method') return { stdout: '{}\n', stderr: '' };
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.alreadyExisted, false);
});

test('is idempotent when repository, deploy key and resolved config already match', async () => {
  const templatePath = await makeTemplate();
  const { config, configPath } = await makeConfig();
  config.brain.owner = 'octocat';
  config.brain.sshUrl = 'git@github.com:octocat/brain4u.git';
  await mkdir(path.dirname(config.brain.deployKeyFile), { recursive: true });
  await writeFile(config.brain.deployKeyFile, 'PRIVATE TEST KEY\n', { mode: 0o600 });
  await writeFile(`${config.brain.deployKeyFile}.pub`, 'ssh-ed25519 AAAATESTKEY brain4u-runtime\n', { mode: 0o644 });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });

  const result = await createBrainRepositoryCommand({
    config,
    configPath,
    templatePath,
    runProcessImpl: async (command, args) => {
      if (command === 'gh' && args[0] === 'auth') return { stdout: '', stderr: '' };
      if (command === 'gh' && args[0] === 'api' && args[1] === 'user') return { stdout: 'octocat\n', stderr: '' };
      if (command === 'gh' && args[0] === 'repo') return { stdout: JSON.stringify({ url: 'https://github.com/octocat/brain4u', visibility: 'PRIVATE', defaultBranchRef: { name: 'main' } }), stderr: '' };
      if (command === 'gh' && args[0] === 'api' && args[1].includes('.brain4u-template-version')) return { stdout: '.brain4u-template-version\n', stderr: '' };
      if (command === 'gh' && args[0] === 'api' && args[1] === 'repos/octocat/brain4u/keys') {
        return { stdout: `${JSON.stringify({ id: 1, key: 'ssh-ed25519 AAAATESTKEY', read_only: false })}\n`, stderr: '' };
      }
      throw new Error(`Unexpected mutation: ${command} ${args.join(' ')}`);
    },
  });
  assert.equal(result.alreadyExisted, true);
  assert.equal(result.deployKeyCreated, false);
  assert.equal(result.deployKeyRegistered, false);
  assert.equal(result.configUpdated, false);
  assert.equal(result.mutationsPerformed, false);
});
