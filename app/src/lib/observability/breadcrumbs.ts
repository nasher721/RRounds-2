/**
 * In-memory breadcrumb trail for correlating user actions with errors.
 * No PHI: only short labels and paths (pathname only, no query/hash).
 */

export type BreadcrumbKind = 'nav' | 'action' | 'info'

export interface Breadcrumb {
  t: string
  kind: BreadcrumbKind
  message: string
}

const MAX = 40
const items: Breadcrumb[] = []

export function addBreadcrumb(kind: BreadcrumbKind, message: string): void {
  if (typeof window === 'undefined') return
  const trimmed = message.slice(0, 200)
  items.push({
    t: new Date().toISOString(),
    kind,
    message: trimmed,
  })
  while (items.length > MAX) {
    items.shift()
  }
}

/** Last N breadcrumbs for attaching to telemetry (newest last). */
export function getBreadcrumbTrail(count = 20): Breadcrumb[] {
  if (items.length <= count) return [...items]
  return items.slice(-count)
}

export function clearBreadcrumbs(): void {
  items.length = 0
}
