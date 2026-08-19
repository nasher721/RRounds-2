/**
 * Dev/support API on window for consoles and automation — export diagnostics without the settings UI.
 */
import {
  clearTelemetry,
  exportDiagnosticsReport,
  getErrorFrequencies,
  getRecentEvents,
} from '@/lib/observability/telemetry'
import { clearBreadcrumbs } from '@/lib/observability/breadcrumbs'

export type ObservabilityDebugApi = {
  exportReport: () => Promise<string>
  copyReport: () => Promise<boolean>
  getFrequencies: typeof getErrorFrequencies
  getRecentEvents: typeof getRecentEvents
  clearAll: () => Promise<void>
}

declare global {
  interface Window {
    __RR_OBSERVABILITY__?: ObservabilityDebugApi
  }
}

export function installObservabilityDebugApi(): void {
  if (typeof window === 'undefined') return
  if (window.__RR_OBSERVABILITY__) return

  window.__RR_OBSERVABILITY__ = {
    exportReport: exportDiagnosticsReport,
    async copyReport() {
      const text = await exportDiagnosticsReport()
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        return false
      }
    },
    getFrequencies: getErrorFrequencies,
    getRecentEvents,
    async clearAll() {
      await clearTelemetry()
      clearBreadcrumbs()
    },
  }
}
