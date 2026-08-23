import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadHetznerCredential } from '../src/credentials.js';
import { startHetznerOnboarding, verifyHetznerToken } from '../src/onboarding.js';

const TOKEN = 'B'.repeat(64);

function pricingFetch(expectedToken = TOKEN) {
  return async (url, options) => {
    assert.equal(String(url), 'https://api.hetzner.cloud/v1/pricing');
    assert.equal(options.headers.Authorization, `Bearer ${expectedToken}`);
    return new Response(JSON.stringify({ pricing: { currency: 'EUR' } }), { status: 200 });
  };
}

test('validates a project token without returning the token', async () => {
  const result = await verifyHetznerToken(TOKEN, { fetchImpl: pricingFetch() });
  assert.deepEqual(result, { currency: 'EUR' });
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test('serves a loopback onboarding and stores the submitted token privately', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brain4u-onboarding-test-'));
  let pageHtml = '';
  const result = await startHetznerOnboarding({
    config: { installationId: 'brain4u-test' },
    stateRoot: root,
    fetchImpl: pricingFetch(),
    openBrowserImpl: async (url) => {
      const page = await fetch(url);
      pageHtml = await page.text();
      assert.equal(page.status, 200);
      assert.match(pageHtml, /Crea o abre tu cuenta/);
      assert.match(pageHtml, /Crea el proyecto Brain4U/);
      assert.equal(pageHtml.includes(TOKEN), false);

      const session = new URL(url).searchParams.get('session');
      const response = await fetch(new URL('/connect', url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ session, token: TOKEN }),
      });
      const successHtml = await response.text();
      assert.equal(response.status, 200);
      assert.match(successHtml, /Hetzner conectado/);
      assert.equal(successHtml.includes(TOKEN), false);
    },
  });

  assert.equal(result.connected, true);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
  assert.equal(await loadHetznerCredential(root, 'brain4u-test'), TOKEN);
});
