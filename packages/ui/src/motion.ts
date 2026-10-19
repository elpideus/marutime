import type { Transition, Variants } from 'motion/react';

/** Spring presets. Everything in MaruTime moves with a little bounce. */
export const springs = {
  /** Default for most UI: visible overshoot, settles fast. */
  bouncy: { type: 'spring', stiffness: 520, damping: 26, mass: 0.9 } satisfies Transition,
  /** Tight response for toggles and small controls. */
  snappy: { type: 'spring', stiffness: 760, damping: 36, mass: 0.8 } satisfies Transition,
  /** Slow, calm motion for large surfaces. */
  gentle: { type: 'spring', stiffness: 260, damping: 30, mass: 1 } satisfies Transition,
  /** Celebratory pop (check marks, hearts). */
  pop: { type: 'spring', stiffness: 640, damping: 17, mass: 0.7 } satisfies Transition,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: springs.bouncy },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.16 } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: springs.pop },
  exit: { opacity: 0, scale: 0.94, transition: { duration: 0.14 } },
};

export const stagger = (delayChildren = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delayChildren, delayChildren: 0.02 } },
});

export const tap = { scale: 0.96 } as const;
export const tapSmall = { scale: 0.92 } as const;
export const hoverLift = { y: -2 } as const;
