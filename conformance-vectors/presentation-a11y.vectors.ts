/**
 * Behavioral conformance-vector suite — `presentation-a11y` (#1195, deck/slide standards).
 *
 * THE single conformance story for "is this deck conformant?" without a webdecks project (per #1175): the
 * named, cross-cutting accessibility obligations every surveyed deck framework underuses — reading order,
 * focus management on slide change, slide-change announcement via an ARIA live region — plus the two
 * correctness traps the survey surfaced as conformance (not polish): the reduced-motion gate the native
 * View Transitions API omits (composed from #1183) and fit-scale pointer hit-testing (#1186). Tagged
 * `deck`. Judges only the **observable** platform surface (ARIA / focus / events), never impl internals.
 *
 * The driver (downstream — #899/#091) drives the deck and reads focus + the live region after each change.
 */
import type { ConformanceVectorSuite } from './schema.js';

export const presentationA11ySuite: ConformanceVectorSuite = {
  standard: 'presentation-a11y',
  contract: '@webeverything/presentation-a11y',
  vectors: [
    {
      // Slide-change announcement — a screen reader must learn the slide changed. A conformant deck writes
      // the new position into an ARIA live region (polite), so it is announced without stealing focus.
      id: 'presentation-a11y/announce/slide-change-live-region',
      contract: '@webeverything/presentation-a11y',
      description:
        'Changing slides updates an ARIA live region (e.g. "Slide 2 of 10") so a screen reader announces the change.',
      steps: [
        { do: 'changeSlide', from: 1, to: 2 },
      ],
      expect: {
        finalState: 'slide-2-shown',
        liveRegionAnnounced: true,
        aria: { 'aria-live': 'polite' },
      },
      observeVia: ['liveRegion', 'aria'],
    },
    {
      // Focus management — after a slide change, focus must land on the new slide's region/heading, not be
      // lost to <body> (which strands keyboard + screen-reader users on the old, now-hidden slide).
      id: 'presentation-a11y/focus/lands-on-new-slide',
      contract: '@webeverything/presentation-a11y',
      description:
        'After a slide change, focus moves to the new slide (its heading/region), never lost to document.body.',
      steps: [
        { do: 'focusSlide', slide: 1 },
        { do: 'changeSlide', from: 1, to: 2 },
      ],
      expect: {
        finalState: 'slide-2-shown',
        activeElementWithin: 'slide-2',
        neverObserved: [{ activeElement: 'body' }],
      },
      observeVia: ['activeElement'],
    },
    {
      // Reading order — the off-screen / not-current slides must not be in the tab order or accessibility
      // tree (inert / aria-hidden), so sequential navigation reads only the current slide's content in order.
      id: 'presentation-a11y/reading-order/non-current-inert',
      contract: '@webeverything/presentation-a11y',
      description:
        'Non-current slides are inert / aria-hidden — tab order and the a11y tree expose only the current slide, in DOM reading order.',
      steps: [
        { do: 'changeSlide', from: 1, to: 2 },
        { do: 'tabThroughFocusables' },
      ],
      expect: {
        finalState: 'slide-2-shown',
        focusablesAllWithin: 'slide-2',
        neverObserved: [{ focusedSlide: 'slide-1' }],
      },
      observeVia: ['activeElement', 'tabSequence'],
    },
    {
      // Reduced-motion gate — composes #1183: under prefers-reduced-motion the slide transition is gated
      // off. Re-asserted here as part of the single deck a11y story.
      id: 'presentation-a11y/reduced-motion/transition-gated',
      contract: '@webeverything/presentation-a11y',
      description:
        'Under prefers-reduced-motion, the slide transition is gated off (composes the #1183 reduced-motion vectors).',
      steps: [
        { do: 'setReducedMotion', value: true },
        { do: 'changeSlide', from: 1, to: 2 },
      ],
      expect: {
        finalState: 'slide-2-shown',
        transitionPlayed: false,
        neverObserved: [{ transitionPlayed: true }],
      },
      observeVia: ['transitionPlayed'],
    },
    {
      // Fit-scale hit-testing — when a deck scales to fit the viewport (a CSS transform), interactive
      // targets must still hit-test at their visual position (#1186). A click at a control's on-screen
      // location must activate that control, not a stale untransformed coordinate.
      id: 'presentation-a11y/fit-scale/hit-testing-correct',
      contract: '@webeverything/presentation-a11y',
      description:
        'Under fit-to-viewport scaling, a pointer activation at a control’s visual position hits that control (no scaled-coordinate drift) — the #1186 trap.',
      steps: [
        { do: 'setFitScale', factor: 0.6 },
        { do: 'pointerActivateAtVisual', target: 'next-control' },
      ],
      expect: {
        finalState: 'slide-2-shown',
        activatedControl: 'next-control',
      },
      observeVia: ['activatedControl', 'events'],
    },
  ],
};
