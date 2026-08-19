import { createTimeline, type Timeline } from "animejs"
import { useEffect, useRef, type DependencyList, type RefObject } from "react"

/**
 * Context passed to the timeline setup callback.
 * Always call `timeline.cancel()` on cleanup (handled by the hook); use optional
 * returned cleanup for extra teardown (e.g. removing listeners).
 */
export type AnimeTimelineContext = {
  timeline: Timeline
  /** Same node as `rootRef.current` when the effect ran */
  root: HTMLElement
}

export type AnimeTimelineSetup = (ctx: AnimeTimelineContext) => void | (() => void)

export type UseAnimeTimelineOptions = {
  rootRef: RefObject<HTMLElement | null>
  /** When false, no timeline is created */
  enabled: boolean
  /** When true, skips animation entirely — use `useMotionPreference().prefersReducedMotion` */
  prefersReducedMotion: boolean
  setup: AnimeTimelineSetup
  /** Extra deps to re-run the effect (e.g. `[isActive]`). `enabled` / `prefersReducedMotion` are already tracked. */
  deps?: DependencyList
}

/**
 * Runs an Anime.js v4 timeline when `enabled` and the user allows motion.
 * On unmount or before re-run: optional cleanup from `setup`, then `timeline.cancel()`.
 *
 * Minimal example:
 * ```ts
 * useAnimeTimeline({
 *   rootRef,
 *   enabled: isVisible,
 *   prefersReducedMotion,
 *   setup: ({ timeline, root }) => {
 *     const el = root.querySelector("[data-anime]")
 *     if (!el) return
 *     timeline.add(el, { opacity: [0, 1], y: [16, 0], duration: 500, ease: "outCubic" }, 0)
 *   },
 *   deps: [isVisible],
 * })
 * ```
 */
export const useAnimeTimeline = (options: UseAnimeTimelineOptions): void => {
  const { rootRef, enabled, prefersReducedMotion, setup, deps = [] } = options
  const setupRef = useRef(setup)
  setupRef.current = setup

  useEffect(() => {
    if (!enabled || prefersReducedMotion) {
      return
    }
    const root = rootRef.current
    if (!root) {
      return
    }
    const timeline = createTimeline({ autoplay: true })
    const maybeCleanup = setupRef.current({ timeline, root })
    return () => {
      if (typeof maybeCleanup === "function") {
        maybeCleanup()
      }
      timeline.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies `deps` for re-runs
  }, [enabled, prefersReducedMotion, rootRef, ...deps])
}
