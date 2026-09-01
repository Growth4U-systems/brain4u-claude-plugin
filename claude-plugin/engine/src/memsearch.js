import path from 'node:path';

import { runProcess } from './process.js';

const MARKETPLACE_NAME = 'memsearch-plugins';
const MARKETPLACE_REPOSITORY = 'zilliztech/memsearch';
const MARKETPLACE_SOURCE = 'github';
const PLUGIN_ID = `memsearch@${MARKETPLACE_NAME}`;
const MINIMUM_VERSION = '0.4.19';
const REPAIR = {
  addMarketplace: `claude plugin marketplace add ${MARKETPLACE_REPOSITORY} --scope user`,
  installPlugin: `claude plugin install ${PLUGIN_ID} --scope user`,
  enablePlugin: `claude plugin enable ${PLUGIN_ID} --scope user`,
  updateMarketplace: `claude plugin marketplace update ${MARKETPLACE_NAME}`,
  updatePlugin: `claude plugin update ${PLUGIN_ID} --scope user`,
};

function codedError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function parseJsonArray(stdout, description) {
  let value;
  try {
    value = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Claude returned invalid JSON while listing ${description}`, { cause: error });
  }
  if (!Array.isArray(value)) {
    throw new Error(`Claude returned an invalid ${description} list`);
  }
  return value;
}

function normalizeRepository(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

function isOfficialMarketplace(entry) {
  return entry?.source === MARKETPLACE_SOURCE
    && normalizeRepository(entry.repo) === MARKETPLACE_REPOSITORY;
}

function findOfficialMarketplace(entries) {
  const named = entries.filter((entry) => entry?.name === MARKETPLACE_NAME);
  if (named.length > 1) {
    throw codedError('MEMSEARCH_MARKETPLACE_CONFLICT', `Multiple Claude marketplaces are named ${MARKETPLACE_NAME}`);
  }
  if (named.length === 1 && !isOfficialMarketplace(named[0])) {
    throw codedError('MEMSEARCH_MARKETPLACE_CONFLICT', `Claude marketplace ${MARKETPLACE_NAME} points to an unexpected origin`);
  }

  const aliases = entries.filter((entry) => entry?.name !== MARKETPLACE_NAME && isOfficialMarketplace(entry));
  if (aliases.length > 0) {
    throw codedError('MEMSEARCH_MARKETPLACE_CONFLICT', `Official MemSearch origin is configured under a different marketplace name: ${aliases[0].name ?? 'unknown'}`);
  }
  return named[0] ?? null;
}

function isCurrentProjectScope(entry, currentProjectPath) {
  if (!['project', 'local'].includes(entry?.scope) || entry?.enabled !== true) return false;
  if (typeof entry.projectPath !== 'string' || entry.projectPath.trim() === '') return true;
  return path.resolve(entry.projectPath) === path.resolve(currentProjectPath);
}

function userMemsearchPlugin(entries, currentProjectPath) {
  const conflicting = entries.find((entry) => {
    if (typeof entry?.id !== 'string') return false;
    const [name] = entry.id.split('@');
    const relevantScope = entry.scope === 'user' || isCurrentProjectScope(entry, currentProjectPath);
    return relevantScope && name === 'memsearch' && entry.id !== PLUGIN_ID;
  });
  if (conflicting) {
    throw codedError(
      'MEMSEARCH_PLUGIN_CONFLICT',
      `Active MemSearch plugin points to an unexpected marketplace at ${conflicting.scope} scope: ${conflicting.id}`,
      { conflictingPlugin: { id: conflicting.id, scope: conflicting.scope } },
    );
  }

  const matches = entries.filter((entry) => entry?.scope === 'user' && entry?.id === PLUGIN_ID);
  if (matches.length > 1) {
    throw new Error(`Multiple user-scope installations of ${PLUGIN_ID} were reported`);
  }
  return matches[0] ?? null;
}

function activeClaudeMemPlugin(entries, currentProjectPath) {
  return entries.find((entry) => {
    if (typeof entry?.id !== 'string' || entry.enabled !== true) return false;
    const [name] = entry.id.split('@');
    if (name !== 'claude-mem') return false;
    return ['user', 'managed'].includes(entry.scope) || isCurrentProjectScope(entry, currentProjectPath);
  }) ?? null;
}

function inspectMemoryPlugins(entries, currentProjectPath) {
  const claudeMem = activeClaudeMemPlugin(entries, currentProjectPath);
  if (claudeMem) {
    throw codedError(
      'CLAUDE_MEM_CONFLICT',
      `Claude-Mem is already active at ${claudeMem.scope} scope; MemSearch was not installed to avoid duplicate memory hooks`,
      { conflictingPlugin: { id: claudeMem.id, scope: claudeMem.scope } },
    );
  }
  return userMemsearchPlugin(entries, currentProjectPath);
}

function parseSemver(version) {
  if (typeof version !== 'string') return null;
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4]?.split('.') ?? [],
  };
}

function compareIdentifiers(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left.localeCompare(right);
}

function compareSemver(left, right) {
  const parsedLeft = parseSemver(left);
  const parsedRight = parseSemver(right);
  if (!parsedLeft || !parsedRight) return null;

  for (let index = 0; index < parsedLeft.core.length; index += 1) {
    if (parsedLeft.core[index] !== parsedRight.core[index]) {
      return parsedLeft.core[index] - parsedRight.core[index];
    }
  }
  if (parsedLeft.prerelease.length === 0 && parsedRight.prerelease.length === 0) return 0;
  if (parsedLeft.prerelease.length === 0) return 1;
  if (parsedRight.prerelease.length === 0) return -1;

  const length = Math.max(parsedLeft.prerelease.length, parsedRight.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (parsedLeft.prerelease[index] === undefined) return -1;
    if (parsedRight.prerelease[index] === undefined) return 1;
    const comparison = compareIdentifiers(parsedLeft.prerelease[index], parsedRight.prerelease[index]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

async function listMarketplaces(runProcessImpl) {
  const result = await runProcessImpl('claude', ['plugin', 'marketplace', 'list', '--json'], { timeoutMs: 30_000 });
  return parseJsonArray(result.stdout, 'marketplaces');
}

async function listPlugins(runProcessImpl) {
  const result = await runProcessImpl('claude', ['plugin', 'list', '--json'], { timeoutMs: 30_000 });
  return parseJsonArray(result.stdout, 'plugins');
}

function recordPluginProgress(progress, plugin) {
  progress.pluginPresent = Boolean(plugin);
  progress.pluginEnabled = plugin?.enabled === true;
  const versionComparison = compareSemver(plugin?.version, MINIMUM_VERSION);
  progress.pluginVersionReady = versionComparison !== null && versionComparison >= 0;
}

async function reconcileMemsearch({ runProcessImpl, currentProjectPath, mutations, progress }) {
  const initialMarketplaces = await listMarketplaces(runProcessImpl);
  const marketplace = findOfficialMarketplace(initialMarketplaces);
  progress.marketplaceReady = Boolean(marketplace);
  const initialPlugins = await listPlugins(runProcessImpl);
  const initialPlugin = inspectMemoryPlugins(initialPlugins, currentProjectPath);
  recordPluginProgress(progress, initialPlugin);

  if (!marketplace) {
    await runProcessImpl('claude', [
      'plugin', 'marketplace', 'add', MARKETPLACE_REPOSITORY, '--scope', 'user',
    ], { timeoutMs: 120_000 });
    mutations.marketplaceAdded = true;

    const addedMarketplaces = await listMarketplaces(runProcessImpl);
    progress.marketplaceReady = Boolean(findOfficialMarketplace(addedMarketplaces));
    if (!progress.marketplaceReady) {
      throw new Error(`Claude did not register the official ${MARKETPLACE_NAME} marketplace`);
    }
  }

  if (!initialPlugin) {
    await runProcessImpl('claude', [
      'plugin', 'install', PLUGIN_ID, '--scope', 'user',
    ], { timeoutMs: 120_000 });
    mutations.pluginInstalled = true;
    progress.pluginPresent = true;
  } else if (initialPlugin.enabled !== true) {
    await runProcessImpl('claude', [
      'plugin', 'enable', PLUGIN_ID, '--scope', 'user',
    ], { timeoutMs: 120_000 });
    mutations.pluginEnabled = true;
  }

  let installedPlugins = await listPlugins(runProcessImpl);
  let installedPlugin = inspectMemoryPlugins(installedPlugins, currentProjectPath);
  recordPluginProgress(progress, installedPlugin);
  if (!installedPlugin) {
    throw new Error(`Claude did not register ${PLUGIN_ID} at user scope`);
  }
  if (installedPlugin.enabled !== true && !mutations.pluginEnabled) {
    await runProcessImpl('claude', [
      'plugin', 'enable', PLUGIN_ID, '--scope', 'user',
    ], { timeoutMs: 120_000 });
    mutations.pluginEnabled = true;
    installedPlugins = await listPlugins(runProcessImpl);
    installedPlugin = inspectMemoryPlugins(installedPlugins, currentProjectPath);
    recordPluginProgress(progress, installedPlugin);
    if (!installedPlugin) {
      throw new Error(`Claude did not retain ${PLUGIN_ID} after enabling it`);
    }
  }

  const versionComparison = compareSemver(installedPlugin.version, MINIMUM_VERSION);
  if (versionComparison === null || versionComparison < 0) {
    await runProcessImpl('claude', [
      'plugin', 'marketplace', 'update', MARKETPLACE_NAME,
    ], { timeoutMs: 120_000 });
    mutations.marketplaceUpdated = true;
    await runProcessImpl('claude', [
      'plugin', 'update', PLUGIN_ID, '--scope', 'user',
    ], { timeoutMs: 120_000 });
    mutations.pluginUpdated = true;
  }

  const finalMarketplaces = await listMarketplaces(runProcessImpl);
  const finalMarketplace = findOfficialMarketplace(finalMarketplaces);
  progress.marketplaceReady = Boolean(finalMarketplace);
  if (!finalMarketplace) {
    throw new Error(`Claude did not retain the official ${MARKETPLACE_NAME} marketplace`);
  }

  const finalPlugins = await listPlugins(runProcessImpl);
  const finalPlugin = inspectMemoryPlugins(finalPlugins, currentProjectPath);
  recordPluginProgress(progress, finalPlugin);
  if (!finalPlugin) throw new Error(`Claude did not retain ${PLUGIN_ID} at user scope`);
  if (finalPlugin.enabled !== true) throw new Error(`${PLUGIN_ID} is not enabled at user scope`);
  const finalVersionComparison = compareSemver(finalPlugin.version, MINIMUM_VERSION);
  if (finalVersionComparison === null || finalVersionComparison < 0) {
    throw new Error(`${PLUGIN_ID} must be at least version ${MINIMUM_VERSION}; found ${finalPlugin.version ?? 'unknown'}`);
  }

  const mutationsPerformed = Object.values(mutations).some(Boolean);
  return {
    ok: true,
    componentOk: true,
    status: 'ready',
    command: 'install-memsearch',
    marketplace: MARKETPLACE_NAME,
    marketplaceRepository: MARKETPLACE_REPOSITORY,
    plugin: PLUGIN_ID,
    version: finalPlugin.version,
    minimumVersion: MINIMUM_VERSION,
    scope: 'user',
    enabled: true,
    skipRequested: false,
    ...mutations,
    mutationsPerformed,
    restartRequired: mutationsPerformed,
    reloadRecommended: true,
    sourcePolicy: 'official-upstream-compatible',
  };
}

function conciseError(error) {
  const detail = error?.result?.stderr?.trim() || error?.message || 'Unknown MemSearch installation error';
  return String(detail).replace(/\s+/g, ' ').trim().slice(0, 1_000);
}

function repairCommands(progress, mutations) {
  const commands = [];
  if (!progress.marketplaceReady) commands.push(REPAIR.addMarketplace);
  if (!progress.pluginPresent) {
    commands.push(REPAIR.installPlugin, REPAIR.enablePlugin);
  } else {
    if (!progress.pluginVersionReady) {
      if (progress.marketplaceReady && !mutations.marketplaceUpdated) commands.push(REPAIR.updateMarketplace);
      commands.push(REPAIR.updatePlugin);
    }
    if (!progress.pluginEnabled) commands.push(REPAIR.enablePlugin);
  }
  return [...new Set(commands)];
}

export async function installMemsearchCommand({
  runProcessImpl = runProcess,
  currentProjectPath = process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  skip = false,
  continueOnError = false,
} = {}) {
  if (typeof runProcessImpl !== 'function') throw new Error('runProcessImpl must be a function');

  if (skip) {
    return {
      ok: true,
      componentOk: null,
      status: 'skipped',
      command: 'install-memsearch',
      skipRequested: true,
      enabled: null,
      mutationsPerformed: false,
      restartRequired: false,
      reloadRecommended: false,
    };
  }

  const mutations = {
    marketplaceAdded: false,
    marketplaceUpdated: false,
    pluginInstalled: false,
    pluginEnabled: false,
    pluginUpdated: false,
  };
  const progress = {
    marketplaceReady: false,
    pluginPresent: false,
    pluginEnabled: false,
    pluginVersionReady: false,
  };

  try {
    return await reconcileMemsearch({ runProcessImpl, currentProjectPath, mutations, progress });
  } catch (error) {
    if (!continueOnError) throw error;
    const conflict = error.conflictingPlugin ?? null;
    const conflictDetected = [
      'CLAUDE_MEM_CONFLICT',
      'MEMSEARCH_MARKETPLACE_CONFLICT',
      'MEMSEARCH_PLUGIN_CONFLICT',
    ].includes(error.code);
    const mutationsPerformed = Object.values(mutations).some(Boolean);
    return {
      ok: true,
      componentOk: false,
      status: 'warning',
      command: 'install-memsearch',
      skipRequested: false,
      error: {
        code: error.code || 'MEMSEARCH_INSTALLATION_FAILED',
        message: conciseError(error),
      },
      conflictingPlugin: conflict,
      repairCommands: conflictDetected ? [] : repairCommands(progress, mutations),
      actionRequired: conflictDetected ? 'review-existing-memory-configuration' : 'retry-when-online',
      enabled: progress.pluginEnabled ? true : null,
      ...mutations,
      mutationsPerformed,
      restartRequired: mutationsPerformed,
      reloadRecommended: mutationsPerformed,
    };
  }
}
