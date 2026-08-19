import type { Variants, Transition } from 'framer-motion';

// ─── Transition Presets ─────────────────────────────────────────────
export const transitions = {
    spring: {
        type: 'spring',
        stiffness: 300,
        damping: 24,
    } as Transition,
    springBouncy: {
        type: 'spring',
        stiffness: 500,
        damping: 15,
    } as Transition,
    springStiff: {
        type: 'spring',
        stiffness: 700,
        damping: 30,
    } as Transition,
    smooth: {
        type: 'tween',
        duration: 0.3,
        ease: 'easeInOut',
    } as Transition,
    snappy: {
        type: 'tween',
        duration: 0.15,
        ease: [0.25, 0.1, 0.25, 1],
    } as Transition,
} as const;

// ─── Reusable Variants ──────────────────────────────────────────────
export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};

export const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
};

export const fadeInDown: Variants = {
    hidden: { opacity: 0, y: -12 },
    visible: { opacity: 1, y: 0 },
};

export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1 },
};

export const slideInLeft: Variants = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0 },
};

// ─── Staggered Container ──────────────────────────────────────────
export function staggerContainer(
    stagger = 0.06,
    delay = 0.1,
): Variants {
    return {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: stagger,
                delayChildren: delay,
            },
        },
    };
}

export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 300, damping: 24 },
    },
};

// ─── Card hover (GPU-accelerated only) ──────────────────────────
export const cardHover: Variants = {
    rest: { scale: 1, y: 0, boxShadow: 'var(--shadow-card)' },
    hover: {
        scale: 1.005,
        y: -2,
        boxShadow: 'var(--shadow-elevated)',
        transition: { type: 'spring' as const, stiffness: 400, damping: 25 },
    },
    tap: { scale: 0.998 },
};

// ─── Collapse / Expand ─────────────────────────────────────────
export const collapseVariants: Variants = {
    open: {
        height: 'auto',
        opacity: 1,
        transition: {
            height: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2, delay: 0.05 },
        },
    },
    closed: {
        height: 0,
        opacity: 0,
        transition: {
            height: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.15 },
        },
    },
};
