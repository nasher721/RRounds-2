import { createTimeline, stagger, type Timeline } from "animejs"
import { useEffect, type DependencyList } from "react"

export type AnimeTimelineContext = {
  createTimeline: typeof createTimeline
  stagger: typeof stagger
}

export type UseAnimeTimelineOptions = {
  enabled: boolean
  /** Default true: defer until after paint so querySelector targets exist */
  afterLayout?: boolean
}

/**
 * Builds a timeline via factory; calls `revert()` on cleanup.
 * Use for stagger and multi-step sequences. Respect reduced motion via `enabled`.
 */
export const useAnimeTimeline = (
  factory: (ctx: AnimeTimelineContext) => Timeline | null | undefined,
  deps: DependencyList,
  options: UseAnimeTimelineOptions,
): void => {
  const { enabled, afterLayout = true } = options

  useEffect(() => {
    if (!enabled) return

    const tlRef = { current: null as Timeline | null }
    let cancelled = false

    const execute = () => {
      if (cancelled) return
      tlRef.current?.revert()
      const ctx: AnimeTimelineContext = { createTimeline, stagger }
      const next = factory(ctx)
      tlRef.current = next ?? null
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
      tlRef.current?.revert()
      tlRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, afterLayout, ...deps])
}

export { createTimeline, stagger }
