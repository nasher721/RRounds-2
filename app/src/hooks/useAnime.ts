import { useRef, useEffect, useCallback } from 'react'
import { animate, createTimeline } from 'animejs'
import type { JSAnimation } from 'animejs'
import { useMotionPreference } from './useReducedMotion'

type CleanupFn = (() => void) | void

interface AnimeAPI {
  animate: typeof animate
  createTimeline: typeof createTimeline
  el: HTMLElement
}

type AnimeFactory = (api: AnimeAPI) => JSAnimation | CleanupFn

export function useAnime<T extends HTMLElement = HTMLDivElement>(
  factory: AnimeFactory,
  deps: React.DependencyList = [],
) {
  const ref = useRef<T>(null)
  const { prefersReducedMotion } = useMotionPreference()

  const stableFactory = useCallback(factory, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion) return

    const result = stableFactory({ animate, createTimeline, el })

    return () => {
      if (result && typeof result === 'object' && 'pause' in result) {
        ;(result as JSAnimation).pause()
      }
      if (typeof result === 'function') {
        result()
      }
    }
  }, [stableFactory, prefersReducedMotion])

  return ref
}
