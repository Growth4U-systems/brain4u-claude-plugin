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
  let pluginListCalled = false;
  await assert.rejects(
    installMemsearchCommand({
      runProcessImpl: async (command, args) => {
        const key = args.join(' ');
        if (key === 'plugin marketplace list --json') {
          marketplaceListCount += 1;
          return jsonResult([]);
        }
        if (key === 'plugin marketplace add zilliztech/memsearch --scope user') return jsonResult({ ok: true });
        if (key === 'plugin list --json') pluginListCalled = true;
        throw new Error(`Unexpected command: ${commandKey(command, args)}`);
      },
    }),
    /did not register the official memsearch-plugins marketplace/,
  );
  assert.equal(marketplaceListCount, 2);
  assert.equal(pluginListCalled, false);
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
