import assert from 'node:assert/strict';
import test from 'node:test';

import { addMoney, assertWithinLimit, normalizeMoney, parseMoney } from '../src/money.js';

test('compares decimal prices without floating point rounding', () => {
  assert.equal(parseMoney('5.4900000000000000'), 54900000000000000n);
  assert.equal(normalizeMoney('5.4900000000000000'), '5.49');
  assert.equal(addMoney('5.49', '0.50'), '5.99');
  assert.doesNotThrow(() => assertWithinLimit('5.49', '5.49000000'));
  assert.throws(() => assertWithinLimit('5.49000001', '5.49'), /exceeds configured monthly limit/);
});

test('rejects negative, exponential and over-precise money values', () => {
  for (const value of ['-1', '1e3', '1.00000000000000001', '01.00']) {
    assert.throws(() => parseMoney(value), /decimal/);
  }
});
