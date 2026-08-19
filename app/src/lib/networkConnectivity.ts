import { safeSessionStorage } from '@/utils/safeStorage'

const OFFLINE_EVENT_SESSION_KEY = 'network.offline-event'

const rememberOfflineEvent = (): void => {
  safeSessionStorage.setItem(OFFLINE_EVENT_SESSION_KEY, '1')
}

const clearOfflineEvent = (): void => {
  safeSessionStorage.removeItem(OFFLINE_EVENT_SESSION_KEY)
}

/**
 * Browser connectivity state that survives same-tab document reloads.
 *
 * Chromium can restore an app shell from a service worker while DevTools keeps
 * transport offline, yet expose navigator.onLine=true in the new document.
 * The last offline event therefore remains authoritative until the matching
 * online event. sessionStorage keeps this non-sensitive signal scoped to the
 * current tab and prevents guaranteed-failure API retries during that reload.
 */
export function isBrowserKnownOffline(): boolean {
  if (typeof navigator === 'undefined') return false
  if (navigator.onLine === false) {
    rememberOfflineEvent()
    return true
  }
  return safeSessionStorage.getItem(OFFLINE_EVENT_SESSION_KEY) === '1'
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', rememberOfflineEvent)
  window.addEventListener('online', clearOfflineEvent)
  if (navigator.onLine === false) rememberOfflineEvent()
}
