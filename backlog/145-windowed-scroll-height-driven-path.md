---
type: idea
workItem: story
size: 5
parent: "137"
status: resolved
blockedBy: ["137"]
dateOpened: "2026-06-07"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: frontierui/blocks/droplist/Windowed.ts
tags: [droplist, windowed, virtualization, scroll, behavior, pointer, a11y]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Add the scroll / height-driven windowing path to `windowed`

`windowed` (#137) virtualizes a long collection on the **active item** — the keyboard / a11y path
(arrow keys shift the window, the active option is always mounted). That path was built and proven
because happy-dom has **no layout**, so scroll offset and element heights are untestable there.

The pointer/scroll half is still missing: a real virtualizer also windows on **scroll position**,
mapping `scrollTop` + a (fixed or measured) item height to the visible slice, with overscan, and a
spacer/translate so the scrollbar reflects the FULL model. Build that path so a mouse user dragging
the scrollbar through 10k options renders only the visible window, while the active-item invariant
from #137 still holds (the focused option never unmounts even when scrolled out of view).

- Add a `itemHeight` option (fixed) and/or measured-height mode; window from `scrollTop`.
- Keep the scroll path and the active path coherent — both feed one window computation.
- Verify with a Playwright/browser test (real layout), not happy-dom, since this is layout-driven.

Acceptance: `windowed` renders only the visible slice while scrolling a long list with the mouse, the
scrollbar reflects the full model, and the active-always-mounted invariant still holds under scroll.

## Correction (reopened 2026-06-07)

> **Was resolved in error.** The only implementation of this surface was built in the **legacy `plateau` repo**, since confirmed **abandoned** — the initial single-repo prototype, superseded by Web Everything + Frontier UI + plateau-app. It is **not in the live project**: the WE *spec* exists, but there is **no reference implementation** in Frontier UI or the WE `plugs/`, and the (now-removed) `graduatedTo` pointed into dead code. Reopened as a **fresh build** against the live reference implementation (Frontier UI / WE `plugs/`, per we:AGENTS.md) — **do not migrate or consult plateau** (explicitly not a model). The original `## Progress` below describes the void plateau build and is retained only as history.

## Progress

- **Status:** resolved
- **Branch:** plateau repo (`we:src/blocks/attributes/Windowed.ts`), mirroring #137.
- **Plan:** dual-mode `Windowed` — *scroll mode* (real layout + `itemHeight`) derives the window from
  `scrollTop`/`clientHeight`; *count mode* (no layout, happy-dom) keeps the #137 active-driven path
  untouched. Both funnel into one `#render()`. Extract pure `computeScrollWindow`/`spacerHeights`
  helpers (testable without layout); add top/bottom spacers so the scrollbar reflects the full model.
- **Done:**
  - `fui:Windowed.ts` — dual-mode. **Scroll path**: `itemHeight` (fixed) option + measured-uniform
    fallback; window derived from `scrollTop`/`clientHeight` via a `scroll` listener; top/bottom
    spacer blocks (`data-windowed-spacer`, `aria-hidden`, NOT `[composite-descendant]`) keep
    scrollHeight = `total*itemHeight` so the scrollbar reflects the full model. Keyboard moves call
    `#scrollActiveIntoView` → fires the same scroll recompute (one window computation). **Count path**
    (#137) intact when there's no layout/`itemHeight`. Active-always-mounted holds in both.
  - Pure helpers `computeScrollWindow` / `spacerHeights` exported — the layout-free math.
  - Tests (`we:Windowed.test.ts` 7→20): 6 pure `computeScrollWindow` cases (top/middle/bottom/partial/
    zero-overscan/empty), 2 `spacerHeights` cases, 5 synthetic-layout integration tests (fake
    `clientHeight`/`scrollTop`: visible-slice-only, re-window on scroll, spacer sum = full height,
    active-mounted-when-scrolled-away, keyboard-scrolls-active-into-view). Full plateau suite **175/175**.
  - Real-layout proof (decision (a)): added `@playwright/test` to plateau + `we:playwright.config.ts`
    (dedicated port 5180, never collides with a running `npm start` on 3000), a standalone demo
    `__demos__/windowed-scroll.{html,ts}` (5,000 rows, composes the real `Windowed` + `FocusDelegation`,
    bootstraps the platform via `plugs/patch`), and `fui:e2e/windowed-scroll.spec.ts` (5 tests, all green):
    visible-slice-only, scrollbar = full model (`scrollHeight === total*itemHeight`), re-window on mouse
    scroll, active-stays-mounted-when-scrolled-off, keyboard-scrolls-active-into-view. `e2e/` lives
    OUTSIDE `src/` so vitest never collects it. `npm run test:e2e`.
- **Leftovers → new backlog items:** platform `insertAdjacentElement` patch forwards the node where the
  position string belongs (latent, first hit here; Windowed now reconciles via `insertBefore` to dodge
  it) → **#162**; variable per-row heights (only fixed + measured-uniform built) → **#163**; `scrollHeight`
  overshoots by one row while the always-mounted active row is scrolled off-window → **#164**.
- **Done (close-out):** plateau unit suite **188/188**, e2e **5/5**, WE `check:standards` **0 errors**.
- **Notes:** keyboard moves scroll active into view → scroll handler recomputes window, so keyboard +
  scroll stay coherent. plateau `.eslintrc` is pre-existingly broken (flat-config `ignores` key) — unrelated.

## Progress (live build, 2026-06-10)

- **Status:** resolved — built fresh against the **live** Frontier UI reference impl
  (`fui:frontierui/blocks/droplist/Windowed.ts`), not migrated from the abandoned plateau code above.
- **Done:**
  - `fui:Windowed.ts` — added the scroll path alongside the existing count path, one shared window
    computation. New `itemHeight` option switches modes: set → **scroll** (window from
    `scrollTop`/`clientHeight` via a `scroll` listener), unset → **count** (#137 active-driven, the
    only happy-dom-testable path) untouched. Top/bottom spacer `<li data-windowed-spacer aria-hidden>`
    (NOT `[composite-descendant]`) pad to `total × itemHeight` so the scrollbar reflects the full model.
    Keyboard `activedescendantchange` → `#scrollActiveIntoView` sets `scrollTop` then recomputes (one
    window). `#activeIndex` now defaults to `-1` (no active designation until focus/keyboard) so the
    backstop doesn't pin row 0 during pure scrolling.
  - **#023 active-always-mounted holds under scroll** — and `scrollHeight` stays exact: an active row
    scrolled outside the window is kept mounted but **out of flow** (`position:absolute` at its true
    offset), so it never inflates `scrollHeight`. This is the fresh build's answer to the plateau-era
    overshoot (#164) — designed out, not deferred.
  - Pure helpers `computeScrollWindow` / `spacerHeights` exported — the layout-free math.
  - Unit tests (`fui:__tests__/behaviors.test.ts`, 16→28): 7 pure cases (top/middle/bottom/partial/
    zero-overscan/empty window + spacer-sum identity) + 5 synthetic-layout integration tests (faked
    `clientHeight`: visible-slice-only, re-window on scroll, spacer sum = full height, active-mounted-
    when-scrolled-off, keyboard-scrolls-active-into-view).
  - Real-layout proof (Playwright, reusing FUI's existing `test:e2e` + `we:playwright.config.ts` on :3001):
    demo `demos/windowed-scroll.{html,ts}` (5,000 rows, composes the real `Windowed` in scroll mode) +
    `fui:blocks/droplist/__tests__/e2e/windowed-scroll.spec.ts` (6 tests): visible-slice-only,
    `scrollHeight === total × itemHeight` (the assertion happy-dom can't make), re-window on scroll,
    active-stays-mounted-off-window (`position:absolute`), keyboard-scrolls-active-into-view, zero
    console errors.
- **Gate:** FUI unit suite **1357 passed / 7 skipped (88 files)**, scroll e2e **6/6**, WE
  `check:standards` **0 errors**.
- **Leftover:** variable per-row heights (only **fixed** `itemHeight` built) remains for **#163**
  (already open, `blockedBy: ["145"]` — now unblocked). #162/#164 were plateau-era leftovers already
  resolved; #164's overshoot is designed out here.

**Graduated to** `fui:frontierui/blocks/droplist/Windowed.ts` — scroll-driven windowing — itemHeight-gated; computeScrollWindow/spacerHeights pure helpers; #023 active out-of-flow; fui:e2e/windowed-scroll.spec.ts.
