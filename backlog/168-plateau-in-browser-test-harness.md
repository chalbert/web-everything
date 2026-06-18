---
type: issue
workItem: task
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-07"
dateResolved: "2026-06-07"
graduatedTo: none
tags: [plateau, testing, e2e, playwright, custom-elements, demo]
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Plateau needs an in-browser (e2e) test harness for runtime-only behavior

Surfaced closing #160. Plateau's DOM patches (`getStandInElement`, `Node`/`Element`/`Document` patches,
`pathInsertionMethods`) assume real-browser constructors — `import './patch'` throws under happy-dom
(`Class extends value undefined`, from `HTML_CONSTRUCTORS` entries absent in happy-dom). So the
autonomous-element lifecycle that #160 added (rehydration + `connectedCallback` via the patched
insertion path) **cannot** be covered by the vitest/happy-dom suite — it is only verifiable in a real
browser. Today that verification is ad-hoc (a dev-time Playwright probe + the `<auto-complete>` demo
driven manually), with no durable regression guard.

Add a lightweight in-browser test harness to plateau (Playwright, mirroring webeverything's
`plugs/__tests__/e2e` setup): boot the real runtime against the dev server and assert browser-only
invariants. First specs to land:

- autonomous custom element registered via `customElements.define` upgrades and runs
  `connectedCallback` (both HTML-authored and `createElement` + append paths) — the #160 guard;
- the `<auto-complete>` demo boots green: the "par → arrow → enter" async trace commits, the surface
  dismisses, the client diacritic match shows accented options, and there are zero console errors
  (today asserted by hand).

Acceptance: `npm run test:e2e` (or similar) in plateau runs Playwright specs against the dev server;
the autonomous-lifecycle + autocomplete-demo invariants are guarded in CI-style, not by hand.

> **Prerequisite for [#167](/backlog/167-autonomous-element-lifecycle-completeness/).** #167 completes
> the autonomous-element lifecycle (disconnect / attributeChanged / form callbacks), which is
> real-browser-only and can't be unit-tested — this harness is what verifies it. Sequence **#168 → #167**.

## Progress

- **Status:** resolved — both named specs landed and the suite is green.
- **Branch:** plateau repo, working tree (uncommitted per backlog rules).
- **Done:**
  - Harness scaffold pre-existed (seeded by #162: `plateau:plateau/playwright.config.ts`, `e2e/`, `test:e2e`,
    dedicated port 5180, `reuseExistingServer`).
  - **Spec 1 — autonomous connect (#160 guard):** `we:e2e/autonomous-connect.spec.ts` + demo
    `src/plugs/custom-elements/__demos__/autonomous-connect.{html,ts}`. A minimal autonomous
    `<connect-probe>` records each `connectedCallback` into `window.__connectLog`; the spec asserts
    BOTH the HTML-authored path (upgraded when `customElements.define` registers the native stand-in)
    and the `createElement` + append path (patched insertion) fire it, and that the real element
    replaces the stand-in in the live DOM.
  - **Spec 2 — autocomplete demo boots green:** `we:e2e/auto-complete-demo.spec.ts` drives
    `we:/auto-complete-demo.html` — async card "par → ArrowDown → Enter" commits "Paris" and dismisses
    (`aria-expanded=false`); client card surfaces the diacritic match "Pärnu"; zero console errors
    (the channel #156's substrate crash routed through).
- **Result:** `npm run test:e2e` → **17/17** (6 new); `npx vitest run` → **198/198** (demo files not
  collected). Makes durable the by-hand verification #156 closed.
- **Mechanism notes:** HTML-authored autonomous elements upgrade synchronously inside
  `customElements.define` (the native per-tag stand-in's upgrade → `getStandInElement` autonomous
  branch rehydrates by tag and calls `connectedCallback`); `createElement` returns the real class
  (`Document.patch`) and `pathInsertionMethods` fires `connectedCallback` on append. `evaluate`
  object/array serialization is fine on patched pages (#165).
- **Leftovers:** none new — remaining lifecycle callbacks (disconnect / attributeChanged / form) are
  already tracked as [#167](/backlog/167-autonomous-element-lifecycle-completeness/), now unblocked.

**Graduated to** `none` — e2e harness in the legacy plateau repo (now abandoned): test:e2e (we:playwright.config.ts port 5180) + we:autonomous-connect.spec.ts + we:auto-complete-demo.spec.ts; superseded by frontierui’s e2e harness.
