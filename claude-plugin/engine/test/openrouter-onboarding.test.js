import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadOpenRouterCredential } from '../src/credentials.js';
import { startOpenRouterOnboarding, verifyOpenRouterKey } from '../src/openrouter-onboarding.js';

const KEY = `sk-or-v1-${'D'.repeat(48)}`;

function currentKeyFetch(expectedKey = KEY, overrides = {}) {
  return async (url, options) => {
    assert.equal(String(url), 'https://openrouter.ai/api/v1/key');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, `Bearer ${expectedKey}`);
    assert.equal(JSON.stringify({ url, method: options.method }).includes(expectedKey), false);
    return new Response(JSON.stringify({
      data: {
        is_free_tier: true,
        is_management_key: false,
        is_provisioning_key: false,
        limit: null,
        limit_remaining: null,
        ...overrides,
      },
    }), { status: 200 });
  };
}

test('validates an OpenRouter key without returning it', async () => {
  const result = await verifyOpenRouterKey(KEY, { fetchImpl: currentKeyFetch() });
  assert.deepEqual(result, { freeTier: true, limit: null, limitRemaining: null });
  assert.equal(JSON.stringify(result).includes(KEY), false);
});

test('rejects management keys and redacts transport errors', async () => {
  await assert.rejects(
    verifyOpenRouterKey(KEY, { fetchImpl: currentKeyFetch(KEY, { is_management_key: true }) }),
    /administration key/,
  );
  await assert.rejects(
    verifyOpenRouterKey(KEY, { fetchImpl: async () => { throw new Error(`failed ${KEY}`); } }),
    (error) => error.message.includes('[REDACTED]') && !error.message.includes(KEY),
  );
});

test('serves a loopback onboarding and stores the OpenRouter key privately', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-openrouter-onboarding-test-'));
  const result = await startOpenRouterOnboarding({
    config: { installationId: 'brain4u-test' },
    stateRoot: root,
    fetchImpl: currentKeyFetch(),
    openBrowserImpl: async (url) => {
      const page = await fetch(url);
      const pageHtml = await page.text();
      assert.equal(page.status, 200);
      assert.match(pageHtml, /Abre tu cuenta/);
      assert.match(pageHtml, /Crea una clave Brain4U/);
      assert.match(pageHtml, /modo gratuito/);
      assert.equal(pageHtml.includes(KEY), false);

      const session = new URL(url).searchParams.get('session');
      const response = await fetch(new URL('/connect', url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ session, key: KEY }),
      });
      const successHtml = await response.text();
      assert.equal(response.status, 200);
      assert.match(successHtml, /OpenRouter conectado/);
      assert.equal(successHtml.includes(KEY), false);
    },
  });

  assert.equal(result.connected, true);
  assert.equal(JSON.stringify(result).includes(KEY), false);
  assert.equal(await loadOpenRouterCredential(root, 'brain4u-test'), KEY);
});
