import type { Transition, Variants } from 'motion/react';

/**
 * Spring presets, tuned like Apple's: described by how long the motion looks
 * (`visualDuration`) and how much it overshoots (`bounce`), so everything
 * settles quickly and the bounce reads as elasticity rather than wobble.
 */
export const springs = {
  /** Default for most UI: a clean settle with a hint of overshoot. */
  smooth: { type: 'spring', visualDuration: 0.38, bounce: 0.18 } satisfies Transition,
  /** Playful default for things that appear or move into place. */
  bouncy: { type: 'spring', visualDuration: 0.42, bounce: 0.3 } satisfies Transition,
  /** Tight response for toggles, presses and small controls. */
  snappy: { type: 'spring', visualDuration: 0.22, bounce: 0.22 } satisfies Transition,
  /** Slow, calm motion for large surfaces and progress. */
  gentle: { type: 'spring', visualDuration: 0.55, bounce: 0.12 } satisfies Transition,
  /** Celebratory pop (check marks, hearts, stars). */
  pop: { type: 'spring', visualDuration: 0.32, bounce: 0.5 } satisfies Transition,
  /** Big elastic moves: page slides, sheets, carousels. */
  elastic: { type: 'spring', visualDuration: 0.6, bounce: 0.28 } satisfies Transition,
} as const;

/** Quick fade used for exits, which should never bounce. */
export const exitFast: Transition = { duration: 0.14, ease: [0.4, 0, 1, 1] };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: springs.bouncy },
  exit: { opacity: 0, y: 6, scale: 0.98, transition: exitFast },
};

/** Hero-sized entrances: a soft focus pull on top of the rise. Use sparingly. */
export const blurUp: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: springs.gentle },
  exit: { opacity: 0, y: 8, filter: 'blur(4px)', transition: exitFast },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, transition: exitFast },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.86 },
  show: { opacity: 1, scale: 1, transition: springs.pop },
  exit: { opacity: 0, scale: 0.94, transition: exitFast },
};

/** Popovers and menus grow out of their anchor. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: -4 },
  show: { opacity: 1, scale: 1, y: 0, transition: springs.bouncy },
  exit: { opacity: 0, scale: 0.96, y: -2, transition: exitFast },
};

export const stagger = (delayChildren = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delayChildren, delayChildren: 0.02 } },
});

export const tap = { scale: 0.95 } as const;
export const tapSmall = { scale: 0.9 } as const;
export const hoverLift = { y: -3 } as const;
