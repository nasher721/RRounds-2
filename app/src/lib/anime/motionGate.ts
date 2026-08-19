/**
 * Anime.js has no built-in reduced-motion handling.
 * Use with `useMotionPreference()` from `@/hooks/useReducedMotion`:
 * `animeEnabled: shouldRunAnime(prefersReducedMotion)`
 */
export const shouldRunAnime = (prefersReducedMotion: boolean): boolean =>
  !prefersReducedMotion
