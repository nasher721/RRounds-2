import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import { isBrowserKnownOffline } from '@/lib/networkConnectivity'

const originalOnline = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine')

afterEach(() => {
  window.dispatchEvent(new Event('online'))
  if (originalOnline) {
    Object.defineProperty(globalThis.navigator, 'onLine', originalOnline)
  } else {
    Reflect.deleteProperty(globalThis.navigator, 'onLine')
  }
})

test('an offline event remains authoritative across a reload-like navigator reset', () => {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: true,
  })

  window.dispatchEvent(new Event('offline'))
  assert.equal(isBrowserKnownOffline(), true)

  // Chromium service-worker reloads can report navigator.onLine=true even
  // while DevTools transport remains offline. The event-backed session marker
  // must remain authoritative until a real online event clears it.
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: true,
  })
  assert.equal(isBrowserKnownOffline(), true)

  window.dispatchEvent(new Event('online'))
  assert.equal(isBrowserKnownOffline(), false)
})

test('navigator offline state is honored before any event fires', () => {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: false,
  })

  assert.equal(isBrowserKnownOffline(), true)
})
