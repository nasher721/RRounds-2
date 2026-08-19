import type { AnimationParams } from 'animejs'

export const durations = {
  fast: 200,
  normal: 400,
  slow: 600,
  hero: 800,
} as const

export const ease = {
  out: 'out(3)',
  inOut: 'inOut(2)',
  spring: 'spring(1, 80, 10, 0)',
  snappy: 'out(4)',
  gentle: 'out(2)',
} as const

export const staggers = {
  tight: 40,
  normal: 60,
  relaxed: 100,
  cascade: 80,
} as const

export const fadeInUp: Partial<AnimationParams> = {
  opacity: [0, 1],
  translateY: [20, 0],
  duration: durations.normal,
  ease: ease.out,
}

export const fadeIn: Partial<AnimationParams> = {
  opacity: [0, 1],
  duration: durations.normal,
  ease: ease.out,
}

export const scaleIn: Partial<AnimationParams> = {
  opacity: [0, 1],
  scale: [0.92, 1],
  duration: durations.normal,
  ease: ease.spring,
}

export const slideInLeft: Partial<AnimationParams> = {
  opacity: [0, 1],
  translateX: [-30, 0],
  duration: durations.normal,
  ease: ease.out,
}

export const shimmer: Partial<AnimationParams> = {
  opacity: [0.4, 1, 0.4],
  duration: 1200,
  ease: ease.inOut,
  loop: true,
}
