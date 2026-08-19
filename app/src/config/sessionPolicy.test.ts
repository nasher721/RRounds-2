import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS,
  parseSessionIdleTimeoutSeconds,
} from './sessionPolicy.ts'

test('session inactivity policy defaults to 30 minutes outside production configuration', () => {
  assert.equal(parseSessionIdleTimeoutSeconds(undefined), DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS)
  assert.equal(parseSessionIdleTimeoutSeconds('   '), DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS)
})

test('session inactivity policy accepts bounded whole-second values', () => {
  assert.equal(parseSessionIdleTimeoutSeconds('300'), 300)
  assert.equal(parseSessionIdleTimeoutSeconds('1800'), 1800)
  assert.equal(parseSessionIdleTimeoutSeconds('3600'), 3600)
})

test('session inactivity policy rejects disabled, malformed, or unbounded values', () => {
  for (const value of ['0', '299', '3601', '30m', '600.5', '-600']) {
    assert.throws(() => parseSessionIdleTimeoutSeconds(value), /Session inactivity timeout/)
  }
})
