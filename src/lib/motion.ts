// Motion & Animation System
// All animation constants MUST be imported from this file.
// No magic numbers allowed in components.

import { useReducedMotion } from 'motion/react';

export const EASING = {
  soft: [0.32, 0.72, 0, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  easeOut: [0.215, 0.61, 0.355, 1] as const,
  toast: [0.22, 1, 0.36, 1] as const,
  spring: { type: 'spring' as const, stiffness: 360, damping: 24 },
};

export const DURATION = {
  instant: 0.1,
  fast: 0.14,
  normal: 0.22,
  slow: 0.3,
  entrance: 0.4,
};

export const TRANSITIONS = {
  cardHover: { duration: DURATION.fast, ease: EASING.easeOut },
  modalEnter: { duration: DURATION.normal, ease: EASING.soft },
  modalExit: { duration: DURATION.instant, ease: EASING.exit },
  listEnter: { duration: DURATION.normal, ease: EASING.soft },
  buttonPress: { type: 'spring' as const, stiffness: 400, damping: 25 },
  sidebar: { duration: DURATION.slow, ease: EASING.soft },
  pageEnter: { duration: DURATION.normal, ease: EASING.soft },
};

export const listItemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...TRANSITIONS.listEnter, delay: i * 0.04 },
  }),
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: { duration: DURATION.instant, ease: EASING.exit },
  },
};

export const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      y: { type: 'spring' as const, stiffness: 260, damping: 26, mass: 0.8 },
      opacity: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
    },
  },
  exit: { opacity: 0, transition: { duration: DURATION.instant, ease: EASING.exit } },
};

/** Top header bar: float down from above (opposite of page content). */
export const headerVariants = {
  hidden: { opacity: 0, y: -12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      y: { type: 'spring' as const, stiffness: 260, damping: 26, mass: 0.8 },
      opacity: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
    },
  },
  exit: { opacity: 0, transition: { duration: DURATION.instant, ease: EASING.exit } },
};

/** Project sidebar: slide in from the left. */
export const sidebarVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      x: { type: 'spring' as const, stiffness: 260, damping: 26, mass: 0.8 },
      opacity: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
    },
  },
  exit: { opacity: 0, transition: { duration: DURATION.instant, ease: EASING.exit } },
};

/**
 * Dashboard main pane mounts after chrome (header + sidebar) entrance
 * so ReactFlow / overview widgets don't contend for the first frames.
 */
export const DASHBOARD_MAIN_ENTER_DELAY_MS = 160;

export const cardHoverProps = {
  whileHover: {
    y: -2,
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
    transition: TRANSITIONS.cardHover,
  },
  whileTap: { scale: 0.99 },
  transition: { duration: DURATION.fast, ease: EASING.easeOut },
};

/**
 * Theme-aware variant of `cardHoverProps`. In dark mode the hover shadow is
 * strengthened so the lift remains perceptible on dark surfaces.
 */
export function cardHoverPropsFor(isDark: boolean) {
  return {
    whileHover: {
      y: -2,
      boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.45)' : '0 8px 30px rgba(0,0,0,0.08)',
      transition: TRANSITIONS.cardHover,
    },
    whileTap: { scale: 0.99 },
    transition: { duration: DURATION.fast, ease: EASING.easeOut },
  };
}

export const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: TRANSITIONS.modalEnter },
  exit: { opacity: 0, scale: 0.96, y: 8, transition: TRANSITIONS.modalExit },
};

export const breathingDotAnimation = {
  pending: {
    scale: [1, 1.15, 1],
    opacity: [0.4, 0.6, 0.4],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
  },
  in_progress: {
    scale: [1, 1.3, 1],
    opacity: [0.7, 1, 0.7],
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const },
  },
  done: { scale: 1, opacity: 1 },
  skipped: { scale: 0.8, opacity: 0.3 },
};

export const dotColors: Record<'pending' | 'in_progress' | 'done' | 'skipped', string> = {
  pending: '#d4d4d4',
  // Use the theme primary color (#171717) for in-progress to avoid antd default blue.
  in_progress: '#171717',
  done: '#22c55e',
  skipped: '#a3a3a3',
};

/**
 * Theme-aware variant of `dotColors`. In dark mode the in-progress dot is white
 * (matching the inverted primary color) so it stays visible on dark surfaces.
 * Other status colors remain identical across modes for semantic consistency.
 */
export function dotColorsFor(isDark: boolean): Record<'pending' | 'in_progress' | 'done' | 'skipped', string> {
  return {
    pending: isDark ? '#525252' : '#d4d4d4',
    in_progress: isDark ? '#ffffff' : '#171717',
    done: '#22c55e',
    skipped: isDark ? '#737373' : '#a3a3a3',
  };
}

export const heroFloatingAnimation = {
  y: [0, -4, 0],
  transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
};

export function useSafeMotion() {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) {
    return {
      transition: { duration: 0 },
      animate: { opacity: 1 },
      initial: { opacity: 0 },
    };
  }
  return null;
}
