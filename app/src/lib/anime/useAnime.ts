import { animate, type JSAnimation } from "animejs"
import { useEffect, type DependencyList } from "react"

export type UseAnimeOptions = {
  /** When false (e.g. reduced motion), the factory is not run */
  enabled: boolean
  /** Wait two animation frames so layout/DOM from React is settled */
  afterLayout?: boolean
}

/**
 * Runs an imperative `animate()` call with `revert()` on dependency change and unmount.
 * Pair with `useMotionPreference().prefersReducedMotion` — pass `enabled: !prefersReducedMotion`.
 */
export const useAnime = (
  factory: () => JSAnimation | null | undefined,
  deps: DependencyList,
  options: UseAnimeOptions,
): void => {
  const { enabled, afterLayout = false } = options

  useEffect(() => {
    if (!enabled) return

    const animRef = { current: null as JSAnimation | null }
    let cancelled = false

    const execute = () => {
      if (cancelled) return
      animRef.current?.revert()
      const next = factory()
      animRef.current = next ?? null
    }

    let id1 = 0
    let id2 = 0
    if (afterLayout) {
      id1 = requestAnimationFrame(() => {
        id2 = requestAnimationFrame(execute)
      })
    } else {
      execute()
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(id1)
      cancelAnimationFrame(id2)
      animRef.current?.revert()
      animRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies meaningful deps
  }, [enabled, afterLayout, ...deps])
}

export { animate }
