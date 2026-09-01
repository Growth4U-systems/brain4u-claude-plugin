import assert from 'node:assert/strict';
import test from 'node:test';

import { installMemsearchCommand } from '../src/memsearch.js';

const OFFICIAL_MARKETPLACE = {
  name: 'memsearch-plugins',
  source: 'github',
  repo: 'zilliztech/memsearch',
};

function plugin({ version = '0.4.19', enabled = true, scope = 'user', id = 'memsearch@memsearch-plugins' } = {}) {
  return { id, version, enabled, scope };
}

function jsonResult(value) {
  return { stdout: `${JSON.stringify(value)}\n`, stderr: '' };
}

function commandKey(command, args) {
  return [command, ...args].join(' ');
}

test('is a no-op when the official user plugin already meets the minimum version', async () => {
  const calls = [];
  const result = await installMemsearchCommand({
    runProcessImpl: async (command, args) => {
      calls.push(commandKey(command, args));
      if (args.join(' ') === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
      if (args.join(' ') === 'plugin list --json') return jsonResult([plugin()]);
      throw new Error(`Unexpected command: ${commandKey(command, args)}`);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.version, '0.4.19');
  assert.equal(result.enabled, true);
  assert.equal(result.scope, 'user');
  assert.equal(result.mutationsPerformed, false);
  assert.equal(result.restartRequired, false);
  assert.equal(result.reloadRecommended, true);
  assert.deepEqual(calls, [
    'claude plugin marketplace list --json',
    'claude plugin list --json',
    'claude plugin list --json',
    'claude plugin marketplace list --json',
    'claude plugin list --json',
  ]);
});

test('adds the official marketplace and installs MemSearch at user scope', async () => {
  const calls = [];
  let marketplaceInstalled = false;
  let pluginInstalled = false;
  const result = await installMemsearchCommand({
    runProcessImpl: async (command, args) => {
      calls.push(commandKey(command, args));
      const key = args.join(' ');
      if (key === 'plugin marketplace list --json') {
        return jsonResult(marketplaceInstalled ? [OFFICIAL_MARKETPLACE] : []);
      }
      if (key === 'plugin marketplace add zilliztech/memsearch --scope user') {
        marketplaceInstalled = true;
        return jsonResult({ ok: true });
      }
      if (key === 'plugin list --json') return jsonResult(pluginInstalled ? [plugin()] : []);
      if (key === 'plugin install memsearch@memsearch-plugins --scope user') {
        pluginInstalled = true;
        return jsonResult({ ok: true });
      }
      throw new Error(`Unexpected command: ${commandKey(command, args)}`);
    },
  });

  assert.equal(result.marketplaceAdded, true);
  assert.equal(result.pluginInstalled, true);
  assert.equal(result.pluginEnabled, false);
  assert.equal(result.pluginUpdated, false);
  assert.equal(result.mutationsPerformed, true);
  assert.equal(result.restartRequired, true);
  assert.equal(calls.includes('claude plugin marketplace add zilliztech/memsearch --scope user'), true);
  assert.equal(calls.includes('claude plugin install memsearch@memsearch-plugins --scope user'), true);
});

test('verifies the official marketplace before installing its plugin', async () => {
  let marketplaceListCount = 0;
  let pluginInstallCalled = false;
  await assert.rejects(
    installMemsearchCommand({
      runProcessImpl: async (command, args) => {
        const key = args.join(' ');
        if (key === 'plugin marketplace list --json') {
          marketplaceListCount += 1;
          return jsonResult([]);
        }
        if (key === 'plugin marketplace add zilliztech/memsearch --scope user') return jsonResult({ ok: true });
        if (key === 'plugin list --json') return jsonResult([]);
        if (key === 'plugin install memsearch@memsearch-plugins --scope user') pluginInstallCalled = true;
        throw new Error(`Unexpected command: ${commandKey(command, args)}`);
      },
    }),
    /did not register the official memsearch-plugins marketplace/,
  );
  assert.equal(marketplaceListCount, 2);
  assert.equal(pluginInstallCalled, false);
});

test('enables a newly installed plugin when Claude leaves it disabled', async () => {
  let installed = false;
  let enabled = false;
  const result = await installMemsearchCommand({
    runProcessImpl: async (command, args) => {
      const key = args.join(' ');
      if (key === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
      if (key === 'plugin list --json') {
        if (!installed) return jsonResult([]);
        return jsonResult([plugin({ enabled })]);
      }
      if (key === 'plugin install memsearch@memsearch-plugins --scope user') {
        installed = true;
        return jsonResult({ ok: true });
      }
      if (key === 'plugin enable memsearch@memsearch-plugins --scope user') {
        enabled = true;
        return jsonResult({ ok: true });
      }
      throw new Error(`Unexpected command: ${commandKey(command, args)}`);
    },
  });

  assert.equal(result.pluginInstalled, true);
  assert.equal(result.pluginEnabled, true);
  assert.equal(result.version, '0.4.19');
});

test('enables a disabled user-scope installation', async () => {
  let enabled = false;
  const calls = [];
  const result = await installMemsearchCommand({
    runProcessImpl: async (command, args) => {
      calls.push(commandKey(command, args));
      const key = args.join(' ');
      if (key === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
      if (key === 'plugin list --json') return jsonResult([plugin({ enabled })]);
      if (key === 'plugin enable memsearch@memsearch-plugins --scope user') {
        enabled = true;
        return jsonResult({ ok: true });
      }
      throw new Error(`Unexpected command: ${commandKey(command, args)}`);
    },
  });

  assert.equal(result.pluginEnabled, true);
  assert.equal(result.pluginInstalled, false);
  assert.equal(result.pluginUpdated, false);
  assert.equal(result.restartRequired, true);
  assert.equal(calls.includes('claude plugin enable memsearch@memsearch-plugins --scope user'), true);
});

test('refreshes the marketplace and updates versions below 0.4.19', async () => {
  let version = '0.4.18';
  const calls = [];
  const result = await installMemsearchCommand({
    runProcessImpl: async (command, args) => {
      calls.push(commandKey(command, args));
      const key = args.join(' ');
      if (key === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
      if (key === 'plugin list --json') return jsonResult([plugin({ version })]);
      if (key === 'plugin marketplace update memsearch-plugins') return jsonResult({ ok: true });
      if (key === 'plugin update memsearch@memsearch-plugins --scope user') {
        version = '0.4.19';
        return jsonResult({ ok: true });
      }
      throw new Error(`Unexpected command: ${commandKey(command, args)}`);
    },
  });

  assert.equal(result.pluginUpdated, true);
  assert.equal(result.version, '0.4.19');
  assert.equal(result.restartRequired, true);
  assert.equal(calls.includes('claude plugin marketplace update memsearch-plugins'), true);
  assert.equal(calls.includes('claude plugin update memsearch@memsearch-plugins --scope user'), true);
});

test('updates an unparseable installed version and rejects it if it remains below the minimum', async () => {
  let listCount = 0;
  await assert.rejects(
    installMemsearchCommand({
      runProcessImpl: async (command, args) => {
        const key = args.join(' ');
        if (key === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
        if (key === 'plugin list --json') {
          listCount += 1;
          return jsonResult([plugin({ version: listCount < 3 ? 'unknown' : '0.4.18' })]);
        }
        if (key === 'plugin marketplace update memsearch-plugins') return jsonResult({ ok: true });
        if (key === 'plugin update memsearch@memsearch-plugins --scope user') return jsonResult({ ok: true });
        throw new Error(`Unexpected command: ${commandKey(command, args)}`);
      },
    }),
    /must be at least version 0\.4\.19; found 0\.4\.18/,
  );
});

test('rejects a marketplace name collision before making changes', async () => {
  const calls = [];
  await assert.rejects(
    installMemsearchCommand({
      runProcessImpl: async (command, args) => {
        calls.push(commandKey(command, args));
        return jsonResult([{ name: 'memsearch-plugins', source: 'github', repo: 'attacker/memsearch' }]);
      },
    }),
    /points to an unexpected origin/,
  );
  assert.deepEqual(calls, ['claude plugin marketplace list --json']);
});

test('reports marketplace collisions without unsafe repair commands in optional mode', async () => {
  const result = await installMemsearchCommand({
    continueOnError: true,
    runProcessImpl: async () => jsonResult([
      { name: 'memsearch-plugins', source: 'github', repo: 'attacker/memsearch' },
    ]),
  });

  assert.equal(result.componentOk, false);
  assert.equal(result.error.code, 'MEMSEARCH_MARKETPLACE_CONFLICT');
  assert.deepEqual(result.repairCommands, []);
  assert.equal(result.actionRequired, 'review-existing-memory-configuration');
});

test('rejects the official origin configured under a different marketplace name', async () => {
  await assert.rejects(
    installMemsearchCommand({
      runProcessImpl: async () => jsonResult([
        { name: 'different-name', source: 'github', repo: 'https://github.com/zilliztech/memsearch.git' },
      ]),
    }),
    /configured under a different marketplace name/,
  );
});

test('rejects a conflicting user-scope MemSearch plugin', async () => {
  let callCount = 0;
  await assert.rejects(
    installMemsearchCommand({
      runProcessImpl: async (_command, args) => {
        callCount += 1;
        if (args.join(' ') === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
        return jsonResult([plugin({ id: 'memsearch@untrusted-marketplace' })]);
      },
    }),
    /unexpected marketplace/,
  );
  assert.equal(callCount, 2);
});

test('rejects a conflicting active MemSearch plugin in the current project', async () => {
  await assert.rejects(
    installMemsearchCommand({
      currentProjectPath: '/work/current',
      runProcessImpl: async (_command, args) => {
        if (args.join(' ') === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
        return jsonResult([{
          ...plugin({ scope: 'project', id: 'memsearch@untrusted-marketplace' }),
          projectPath: '/work/current',
        }]);
      },
    }),
    /unexpected marketplace at project scope/,
  );
});

test('ignores conflicts in other projects and still installs the required user-scope plugin', async () => {
  let installed = false;
  const result = await installMemsearchCommand({
    currentProjectPath: '/work/current',
    runProcessImpl: async (command, args) => {
      const key = args.join(' ');
      if (key === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
      if (key === 'plugin list --json') {
        const entries = [{
          ...plugin({ scope: 'project', id: 'memsearch@another-marketplace' }),
          projectPath: '/work/other',
        }];
        if (installed) entries.push(plugin());
        return jsonResult(entries);
      }
      if (key === 'plugin install memsearch@memsearch-plugins --scope user') {
        installed = true;
        return jsonResult({ ok: true });
      }
      throw new Error(`Unexpected command: ${commandKey(command, args)}`);
    },
  });
  assert.equal(result.pluginInstalled, true);
  assert.equal(result.version, '0.4.19');
});

test('rejects malformed Claude JSON without attempting a mutation', async () => {
  let callCount = 0;
  await assert.rejects(
    installMemsearchCommand({
      runProcessImpl: async () => {
        callCount += 1;
        return { stdout: '{not-json', stderr: '' };
      },
    }),
    /invalid JSON while listing marketplaces/,
  );
  assert.equal(callCount, 1);
});

test('skips MemSearch without inspecting or mutating Claude plugins', async () => {
  let callCount = 0;
  const result = await installMemsearchCommand({
    skip: true,
    runProcessImpl: async () => {
      callCount += 1;
      throw new Error('must not be called');
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.componentOk, null);
  assert.equal(result.status, 'skipped');
  assert.equal(result.skipRequested, true);
  assert.equal(result.enabled, null);
  assert.equal(result.mutationsPerformed, false);
  assert.equal(callCount, 0);
});

test('returns a recoverable warning when optional installation fails', async () => {
  const networkError = new Error('claude exited with code 1');
  networkError.result = { stderr: 'Network request failed: connection reset' };
  const result = await installMemsearchCommand({
    continueOnError: true,
    runProcessImpl: async () => {
      throw networkError;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.componentOk, false);
  assert.equal(result.status, 'warning');
  assert.equal(result.error.code, 'MEMSEARCH_INSTALLATION_FAILED');
  assert.match(result.error.message, /connection reset/);
  assert.equal(result.repairCommands.length, 3);
  assert.equal(result.actionRequired, 'retry-when-online');
  assert.equal(result.mutationsPerformed, false);
  assert.equal(result.reloadRecommended, false);
});

test('preserves partial mutations and only suggests the remaining repair steps', async () => {
  let marketplaceInstalled = false;
  const networkError = new Error('claude exited with code 1');
  networkError.result = { stderr: 'Network request failed while installing MemSearch' };
  const result = await installMemsearchCommand({
    continueOnError: true,
    runProcessImpl: async (_command, args) => {
      const key = args.join(' ');
      if (key === 'plugin marketplace list --json') {
        return jsonResult(marketplaceInstalled ? [OFFICIAL_MARKETPLACE] : []);
      }
      if (key === 'plugin list --json') return jsonResult([]);
      if (key === 'plugin marketplace add zilliztech/memsearch --scope user') {
        marketplaceInstalled = true;
        return jsonResult({ ok: true });
      }
      if (key === 'plugin install memsearch@memsearch-plugins --scope user') throw networkError;
      throw new Error(`Unexpected command: ${key}`);
    },
  });

  assert.equal(result.componentOk, false);
  assert.equal(result.marketplaceAdded, true);
  assert.equal(result.pluginInstalled, false);
  assert.equal(result.mutationsPerformed, true);
  assert.equal(result.restartRequired, true);
  assert.equal(result.reloadRecommended, true);
  assert.equal(result.repairCommands.includes('claude plugin marketplace add zilliztech/memsearch --scope user'), false);
  assert.equal(result.repairCommands.includes('claude plugin install memsearch@memsearch-plugins --scope user'), true);
  assert.equal(result.repairCommands.includes('claude plugin enable memsearch@memsearch-plugins --scope user'), true);
});

test('records a marketplace update when the following plugin update fails', async () => {
  const networkError = new Error('claude exited with code 1');
  networkError.result = { stderr: 'Network request failed while updating the plugin' };
  const result = await installMemsearchCommand({
    continueOnError: true,
    runProcessImpl: async (_command, args) => {
      const key = args.join(' ');
      if (key === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
      if (key === 'plugin list --json') return jsonResult([plugin({ version: '0.4.18' })]);
      if (key === 'plugin marketplace update memsearch-plugins') return jsonResult({ ok: true });
      if (key === 'plugin update memsearch@memsearch-plugins --scope user') throw networkError;
      throw new Error(`Unexpected command: ${key}`);
    },
  });

  assert.equal(result.componentOk, false);
  assert.equal(result.marketplaceUpdated, true);
  assert.equal(result.pluginUpdated, false);
  assert.equal(result.mutationsPerformed, true);
  assert.equal(result.restartRequired, true);
  assert.equal(result.repairCommands.includes('claude plugin marketplace update memsearch-plugins'), false);
  assert.equal(result.repairCommands.includes('claude plugin update memsearch@memsearch-plugins --scope user'), true);
});

test('does not suggest reinstalling after install succeeds but verification fails', async () => {
  let pluginInstalled = false;
  const verificationError = new Error('claude exited with code 1');
  verificationError.result = { stderr: 'Could not read plugin state' };
  const result = await installMemsearchCommand({
    continueOnError: true,
    runProcessImpl: async (_command, args) => {
      const key = args.join(' ');
      if (key === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
      if (key === 'plugin list --json') {
        if (pluginInstalled) throw verificationError;
        return jsonResult([]);
      }
      if (key === 'plugin install memsearch@memsearch-plugins --scope user') {
        pluginInstalled = true;
        return jsonResult({ ok: true });
      }
      throw new Error(`Unexpected command: ${key}`);
    },
  });

  assert.equal(result.componentOk, false);
  assert.equal(result.pluginInstalled, true);
  assert.equal(result.mutationsPerformed, true);
  assert.equal(result.repairCommands.includes('claude plugin install memsearch@memsearch-plugins --scope user'), false);
  assert.equal(result.repairCommands.includes('claude plugin update memsearch@memsearch-plugins --scope user'), true);
  assert.equal(result.repairCommands.includes('claude plugin enable memsearch@memsearch-plugins --scope user'), true);
});

test('detects active Claude-Mem and does not install a second memory plugin', async () => {
  const calls = [];
  const result = await installMemsearchCommand({
    continueOnError: true,
    runProcessImpl: async (command, args) => {
      calls.push(commandKey(command, args));
      if (args.join(' ') === 'plugin marketplace list --json') return jsonResult([]);
      if (args.join(' ') === 'plugin list --json') {
        return jsonResult([plugin({ id: 'claude-mem@thedotmack' })]);
      }
      throw new Error(`Unexpected command: ${commandKey(command, args)}`);
    },
  });

  assert.equal(result.componentOk, false);
  assert.equal(result.error.code, 'CLAUDE_MEM_CONFLICT');
  assert.deepEqual(result.conflictingPlugin, { id: 'claude-mem@thedotmack', scope: 'user' });
  assert.deepEqual(result.repairCommands, []);
  assert.equal(result.actionRequired, 'review-existing-memory-configuration');
  assert.equal(calls.some((call) => call.includes('marketplace add')), false);
  assert.equal(calls.some((call) => call.includes('plugin install')), false);
});

test('detects managed Claude-Mem and does not install a second memory plugin', async () => {
  const calls = [];
  const result = await installMemsearchCommand({
    continueOnError: true,
    runProcessImpl: async (command, args) => {
      calls.push(commandKey(command, args));
      if (args.join(' ') === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
      if (args.join(' ') === 'plugin list --json') {
        return jsonResult([plugin({ id: 'claude-mem@thedotmack', scope: 'managed' })]);
      }
      throw new Error(`Unexpected command: ${commandKey(command, args)}`);
    },
  });

  assert.equal(result.componentOk, false);
  assert.equal(result.error.code, 'CLAUDE_MEM_CONFLICT');
  assert.deepEqual(result.conflictingPlugin, { id: 'claude-mem@thedotmack', scope: 'managed' });
  assert.deepEqual(result.repairCommands, []);
  assert.equal(calls.some((call) => call.includes('plugin install')), false);
});

test('ignores disabled Claude-Mem and installs MemSearch normally', async () => {
  let installed = false;
  const result = await installMemsearchCommand({
    runProcessImpl: async (command, args) => {
      const key = args.join(' ');
      if (key === 'plugin marketplace list --json') return jsonResult([OFFICIAL_MARKETPLACE]);
      if (key === 'plugin list --json') {
        const entries = [plugin({ id: 'claude-mem@thedotmack', enabled: false })];
        if (installed) entries.push(plugin());
        return jsonResult(entries);
      }
      if (key === 'plugin install memsearch@memsearch-plugins --scope user') {
        installed = true;
        return jsonResult({ ok: true });
      }
      throw new Error(`Unexpected command: ${commandKey(command, args)}`);
    },
  });

  assert.equal(result.componentOk, true);
  assert.equal(result.pluginInstalled, true);
});
