/**
 * Behavioral conformance-vector suite — `slide-transition-reduced-motion` (#1183, deck/slide standards).
 *
 * Slide-to-slide transitions compose the View Transitions API + the Motion intent. The load-bearing
 * correctness trap the cross-framework survey surfaced: **the native View Transitions API does NOT
 * auto-respect `prefers-reduced-motion`** — only Marp gates it out of the box. So a conforming deck must
 * gate the transition itself; this is a *conformance obligation*, not an author option. These vectors
 * judge only the **observable** outcome (did an animated transition play, or an instant swap) through the
 * platform surface — never impl internals. Folded into the named deck a11y vector set (#1195, tag `deck`).
 *
 * The driver (downstream — #899/#091) sets the reduced-motion preference, triggers a slide change, and
 * observes whether a View Transition animation ran.
 */
import type { ConformanceVectorSuite } from './schema.js';

export const slideTransitionReducedMotionSuite: ConformanceVectorSuite = {
  standard: 'slide-transition-reduced-motion',
  contract: '@webeverything/slide-transition',
  vectors: [
    {
      // The trap: reduced-motion is requested, yet a naive deck lets the native View Transition animate.
      // A conformant deck gates it — the slide swaps instantly, no cross-fade / morph plays.
      id: 'slide-transition-reduced-motion/gate/reduced-motion-instant',
      contract: '@webeverything/slide-transition',
      description:
        'Under prefers-reduced-motion, a slide change must swap instantly — the View Transition is gated off (the native API does not do this automatically).',
      steps: [
        { do: 'setReducedMotion', value: true },
        { do: 'changeSlide', from: 1, to: 2 },
      ],
      expect: {
        finalState: 'slide-2-shown',
        transitionPlayed: false,
        neverObserved: [{ transitionPlayed: true }],
      },
      observeVia: ['transitionPlayed', 'activeSlide'],
    },
    {
      // The baseline: no reduced-motion preference → the slide-to-slide View Transition animates normally.
      id: 'slide-transition-reduced-motion/baseline/animated',
      contract: '@webeverything/slide-transition',
      description:
        'With motion allowed, a slide change plays the composed View Transition (the default directional/fade feel).',
      steps: [
        { do: 'setReducedMotion', value: false },
        { do: 'changeSlide', from: 1, to: 2 },
      ],
      expect: {
        finalState: 'slide-2-shown',
        transitionPlayed: true,
      },
      observeVia: ['transitionPlayed', 'activeSlide'],
    },
    {
      // Reverse traversal (back-nav) is equally gated — the trap is symmetric across direction.
      id: 'slide-transition-reduced-motion/gate/reverse-instant',
      contract: '@webeverything/slide-transition',
      description: 'Reduced-motion also gates the back-navigation transition — no reverse animation plays.',
      steps: [
        { do: 'setReducedMotion', value: true },
        { do: 'changeSlide', from: 2, to: 1 },
      ],
      expect: {
        finalState: 'slide-1-shown',
        transitionPlayed: false,
        neverObserved: [{ transitionPlayed: true }],
      },
      observeVia: ['transitionPlayed', 'activeSlide'],
    },
  ],
};
