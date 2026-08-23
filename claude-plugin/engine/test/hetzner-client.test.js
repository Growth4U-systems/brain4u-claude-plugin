import assert from 'node:assert/strict';
import test from 'node:test';

import { HetznerClient } from '../src/hetzner-client.js';

test('sends the token only in the authorization header', async () => {
  const calls = [];
  const client = new HetznerClient({
    token: 'sensitive-token-value',
    endpoint: 'https://api.example.test/v1',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ servers: [], meta: { pagination: { next_page: null } } }), { status: 200 });
    },
  });

  await client.listAll('/servers', 'servers', { name: 'brain4u-test' });
  assert.equal(calls[0].options.headers.Authorization, 'Bearer sensitive-token-value');
  assert.equal(calls[0].url.includes('sensitive-token-value'), false);
  assert.equal(calls[0].options.body, undefined);
});

test('never includes the token in transport or API errors', async () => {
  const token = 'sensitive-token-value';
  const transportClient = new HetznerClient({
    token,
    fetchImpl: async () => { throw new Error(`connection failed for ${token}`); },
  });
  await assert.rejects(transportClient.get('/servers'), (error) => {
    assert.equal(error.message.includes(token), false);
    return true;
  });

  const apiClient = new HetznerClient({
    token,
    fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'invalid input' } }), { status: 401 }),
  });
  await assert.rejects(apiClient.get('/servers'), /Hetzner API unauthorized: invalid input/);
});
