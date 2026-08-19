import { type RefObject, useEffect, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { createTimeline } from 'animejs';
import { durations, ease } from '@/lib/anime-presets';
import { useMotionPreference } from '@/hooks/useReducedMotion';

/**
 * Page transition variants for smooth navigation
 */
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

/**
 * Fade-only variant for subtle transitions
 */
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * Slide-up variant for modals/sheets
 */
export const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
  exit: { 
    opacity: 0, 
    y: 8,
    transition: { duration: 0.15 },
  },
};

/**
 * Hook for an anime.js clip-path wipe entrance.
 * Attach the returned ref to a wrapper div around route content.
 * The element clips from left-to-right while fading in.
 */
export function useClipWipeEntrance<T extends HTMLElement = HTMLDivElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  const { prefersReducedMotion } = useMotionPreference();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion) {
      el.style.opacity = '1';
      el.style.clipPath = 'none';
      return;
    }

    el.style.opacity = '0';
    el.style.clipPath = 'inset(0 100% 0 0)';

    const tl = createTimeline({ defaults: { ease: ease.out } })
      .add(el, {
        opacity: [0, 1],
        clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'],
        duration: durations.slow,
      }, 0);

    return () => { tl.pause(); };
  }, [prefersReducedMotion]);

  return ref;
}

export { motion, AnimatePresence };
