import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateFormula } from './phraseExpander';

test('calculateFormula evaluates bounded arithmetic with variables and precedence', () => {
  assert.equal(calculateFormula('score = weight * 2 + age / 4', { weight: 10, age: 20 }), 25);
  assert.equal(calculateFormula('-(weight - 2.5) * +2', { weight: 10 }), -15);
  assert.equal(calculateFormula('.5 + 1.005', {}), 1.51);
});

test('calculateFormula rejects executable or malformed input', () => {
  assert.equal(calculateFormula('globalThis.alert(1)', {}), null);
  assert.equal(calculateFormula('1 + unknown', {}), null);
  assert.equal(calculateFormula('1..2 + 3', {}), null);
  assert.equal(calculateFormula('1 / 0', {}), null);
});

test('calculateFormula bounds parser work and nesting', () => {
  assert.equal(calculateFormula('1+'.repeat(600) + '1', {}), null);
  assert.equal(calculateFormula('('.repeat(51) + '1' + ')'.repeat(51), {}), null);
});

test('calculateFormula treats known non-numeric values as zero without exposing them', () => {
  assert.equal(calculateFormula('count + 2', { count: 'not-a-number' }), 2);
  assert.equal(calculateFormula('count + 2', { count: Number.POSITIVE_INFINITY }), 2);
});
