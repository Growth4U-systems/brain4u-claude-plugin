import assert from 'node:assert/strict';
import test from 'node:test';

import { redact } from '../src/redact.js';

test('redacts explicit and recognizable credentials', () => {
  const secret = 'private-provider-value';
  const slackToken = ['xoxb', 'example', 'value'].join('-');
  const openRouterToken = ['sk', 'or', 'v1', 'example'].join('-');
  const output = redact(`failure ${secret} ${slackToken} ${openRouterToken}`, [secret]);
  assert.equal(output.includes(secret), false);
  assert.equal(output.includes(slackToken), false);
  assert.equal(output.includes(openRouterToken), false);
});
