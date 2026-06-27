/**
 * Behavioral conformance-vector suite — `nav-list` a11y (#1833, W3C APG Disclosure Navigation).
 *
 * The base-block a11y contract the composition rule protects (we:docs/agent/platform-decisions.md
 * #composition-preserves-a11y-contract, #1795/#1832) had no executable verification target: the APG
 * Disclosure Navigation pattern lived in-tree only as the we:demos/reveal-nav-conformance.ts demo with
 * inline ad-hoc checks, and the existing a11y vectors (presentation-a11y) are deck/slide-specific. This
 * suite is the missing contract — the named, cross-cutting a11y obligations a conformant nav-list disclosure
 * must satisfy, expressed once as the corpus the #899 driver runs against any candidate so "is this nav
 * conformant?" becomes checkable rather than asserted, independent of how the block is built.
 *
 * It pins the FOUR dimensions the add-only invariant is stated across (roles · focus order · keyboard ·
 * aria), each as the base-block obligation a composed re-skin must preserve non-destructively:
 *   - roles      → it is a DISCLOSURE, not an ARIA menu: button[aria-expanded] heads + plain <a> links,
 *                  never role=menu / role=menuitem (the trap the #931 hand-roll fell into).
 *   - focus      → roving tabindex across the section heads: exactly one head is tabbable, arrows move it.
 *   - keyboard   → Enter/Space toggle a section's disclosure; Escape collapses the open one and refocuses
 *                  its head; opening a section closes its siblings.
 *   - aria       → each head exposes aria-expanded mirroring the panel state + aria-controls to its panel;
 *                  the active link carries aria-current.
 *
 * Judges only the **observable** platform surface (ARIA / focus / events / tab order), never impl internals.
 * The driver (downstream — #899/#091) drives the nav and reads role/focus/aria after each step.
 */
import type { ConformanceVectorSuite } from './schema.js';

export const navListA11ySuite: ConformanceVectorSuite = {
  standard: 'nav-list',
  contract: '@webeverything/nav-list',
  vectors: [
    {
      // ROLES — Disclosure, not a menu. The APG Disclosure Navigation pattern is a set of disclosure
      // buttons over link lists; it is NOT the ARIA menu pattern. A conformant nav exposes button heads
      // carrying aria-expanded and plain <a> links — and NEVER role=menu / role=menuitem (which would
      // import the menu keyboard model and mislead AT). This is the #931 hand-roll trap, made checkable.
      id: 'nav-list/roles/disclosure-not-menu',
      contract: '@webeverything/nav-list',
      description:
        'The nav is a disclosure (button[aria-expanded] heads over plain <a> links), never an ARIA menu — no role=menu / role=menuitem anywhere.',
      steps: [
        { do: 'render' },
      ],
      expect: {
        finalState: 'rendered',
        headRole: 'button',
        linkRole: null, // plain <a>, no role override
        neverObserved: [{ roleObserved: 'menu' }, { roleObserved: 'menuitem' }],
      },
      observeVia: ['headRole', 'linkRole', 'roleObserved'],
    },
    {
      // FOCUS — Roving tabindex across the section heads. Exactly one head is in the tab order
      // (tabindex=0); the rest are tabindex=-1, reachable only via arrow keys. Tab enters the head group
      // once, then arrows move the roving focus head to head (the APG roving-tabindex keyboard interface).
      id: 'nav-list/focus/roving-tabindex-single-tabstop',
      contract: '@webeverything/nav-list',
      description:
        'The section heads form one tab stop (roving tabindex): exactly one head is tabbable, ArrowRight/ArrowDown move the roving focus to the next head.',
      steps: [
        { do: 'tabInto', target: 'nav-heads' },
        { do: 'pressKey', key: 'ArrowDown' },
      ],
      expect: {
        finalState: 'head-2-focused',
        tabbableHeadCount: 1,
        activeElementWithin: 'head-2',
        neverObserved: [{ tabbableHeadCount: 2 }],
      },
      observeVia: ['tabbableHeadCount', 'activeElementWithin'],
    },
    {
      // KEYBOARD (disclosure toggle) — Enter and Space on a focused head toggle its disclosure, flipping
      // aria-expanded and showing/hiding the controlled panel. The native keyboard contract of a button.
      id: 'nav-list/keyboard/enter-space-toggle-disclosure',
      contract: '@webeverything/nav-list',
      description:
        'With a head focused, Enter (and Space) toggles its disclosure — aria-expanded flips and its controlled panel shows/hides.',
      steps: [
        { do: 'focusHead', head: 1 },
        { do: 'pressKey', key: 'Enter' },
      ],
      expect: {
        finalState: 'section-1-expanded',
        aria: { 'aria-expanded': 'true' },
        panelVisible: 'panel-1',
      },
      observeVia: ['aria', 'panelVisible'],
    },
    {
      // KEYBOARD (Escape) — Escape collapses the open section and returns focus to its head (so the
      // keyboard user is not stranded inside a now-hidden panel). aria-expanded returns to false.
      id: 'nav-list/keyboard/escape-collapses-and-refocuses-head',
      contract: '@webeverything/nav-list',
      description:
        'Escape collapses the open section (aria-expanded → false) and moves focus back to that section head.',
      steps: [
        { do: 'expandSection', section: 1 },
        { do: 'focusWithin', region: 'panel-1' },
        { do: 'pressKey', key: 'Escape' },
      ],
      expect: {
        finalState: 'section-1-collapsed',
        aria: { 'aria-expanded': 'false' },
        activeElementWithin: 'head-1',
        neverObserved: [{ activeElement: 'body' }],
      },
      observeVia: ['aria', 'activeElementWithin', 'activeElement'],
    },
    {
      // ARIA (disclosure wiring) — each head carries aria-controls pointing at its panel, and aria-expanded
      // MIRRORS the actual panel visibility at all times (it never drifts from the rendered state). Opening
      // a section closes its siblings, so at most one section is expanded — exactly one aria-expanded=true.
      id: 'nav-list/aria/expanded-mirrors-state-siblings-close',
      contract: '@webeverything/nav-list',
      description:
        'Each head wires aria-controls→panel and aria-expanded mirrors panel visibility; opening a section collapses its siblings (at most one expanded).',
      steps: [
        { do: 'expandSection', section: 1 },
        { do: 'expandSection', section: 2 },
      ],
      expect: {
        finalState: 'section-2-expanded',
        headHasAriaControls: true,
        expandedSectionCount: 1,
        neverObserved: [{ ariaExpandedMismatchesPanel: true }, { expandedSectionCount: 2 }],
      },
      observeVia: ['headHasAriaControls', 'expandedSectionCount', 'ariaExpandedMismatchesPanel'],
    },
    {
      // ARIA (current location) — the link for the current page carries aria-current="page", so AT
      // announces the user's location in the nav. Exactly the active link, never more than one.
      id: 'nav-list/aria/active-link-aria-current-page',
      contract: '@webeverything/nav-list',
      description:
        'The link matching the current location carries aria-current="page" (and only that link).',
      steps: [
        { do: 'setCurrentLocation', href: '/section-1/page-b' },
      ],
      expect: {
        finalState: 'rendered',
        aria: { 'aria-current': 'page' },
        ariaCurrentLinkCount: 1,
        neverObserved: [{ ariaCurrentLinkCount: 2 }],
      },
      observeVia: ['aria', 'ariaCurrentLinkCount'],
    },
  ],
};
