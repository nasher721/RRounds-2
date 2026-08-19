import * as React from "react"
import { motion } from "framer-motion"
import { useMotionPreference } from "@/hooks/useReducedMotion"
import { shouldRunAnime, useAnimeTimeline } from "@/lib/anime"

/**
 * Route-level Suspense fallback: outer Framer Motion handles container opacity only;
 * inner dots use Anime.js stagger (no shared node with motion.*).
 */
export function SuspenseLoadingFallback(): React.ReactElement {
  const innerRef = React.useRef<HTMLDivElement>(null)
  const { prefersReducedMotion } = useMotionPreference()
  const animeEnabled = shouldRunAnime(prefersReducedMotion)

  useAnimeTimeline(
    ({ createTimeline, stagger }) => {
      const root = innerRef.current
      if (!root) return null
      const items = root.querySelectorAll<HTMLElement>("[data-anime-stagger-item]")
      if (items.length === 0) return null
      const tl = createTimeline({ defaults: { ease: "outCubic" } })
      tl.add(items, {
        opacity: { from: 0.35, to: 1 },
        scale: { from: 0.65, to: 1 },
        duration: 420,
        delay: stagger(120, { from: "first" }),
      })
      return tl
    },
    [],
    { enabled: animeEnabled, afterLayout: true },
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center h-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading page"
    >
      <span className="sr-only">Loading page, please wait…</span>
      <div
        ref={innerRef}
        aria-hidden
        className="flex items-center gap-2"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            data-anime-stagger-item
            className="h-2 w-2 rounded-full bg-primary"
            style={animeEnabled ? { opacity: 0.35, transform: "scale(0.65)" } : undefined}
          />
        ))}
      </div>
    </motion.div>
  )
}
