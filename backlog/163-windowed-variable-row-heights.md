---
type: idea
workItem: story
size: 5
parent: "137"
status: resolved
blockedBy: ["145"]
dateOpened: "2026-06-07"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: frontierui/blocks/droplist/Windowed.ts
tags: [droplist, windowed, virtualization, scroll, layout]
relatedProject: webblocks
crossRef: { url: /backlog/145-windowed-scroll-height-driven-path/, label: "#145 windowed scroll path" }
---

# Add variable per-row height support to `windowed`

> **Premise corrected (2026-06-10, after #145's live build).** #145 shipped against the live Frontier
> UI impl (`fui:frontierui/blocks/droplist/Windowed.ts`) with a **fixed `itemHeight` option only** — there
> is *no* measured-uniform fallback (the `#itemHeightPx()` measure-one-row path described below was the
> abandoned plateau design, never built live). So this item also covers the *measured* case from
> scratch. Generalise the pure helpers `computeScrollWindow` / `spacerHeights`, and extend the
> real-layout harness **`fui:frontierui/blocks/droplist/__tests__/e2e/windowed-scroll.spec.ts` +
> `frontierui/demos/windowed-scroll.{html,ts}`** (NOT the dead `plateau/…` paths referenced below).

#145 built the scroll/height-driven path on a **uniform** row-height assumption: a fixed `itemHeight`
option, keeping the window math a pure `scrollTop / itemHeight` map. That covers the common case (every
option the same height).

Real lists can have rows of different heights (wrapped labels, optional secondary lines, group headers).
With a uniform height those rows misalign: the spacer math and `scrollTop → index` map drift, so the
visible slice can be off by a row or two and the scrollbar position won't match the content exactly.

Build the variable-height path:

- Maintain a per-row measured-height cache (offset prefix-sum) so `scrollTop → firstVisible` is a binary
  search over cumulative offsets instead of a division, and the spacers reflect summed real heights.
- Measure lazily (rows are only measurable once mounted) and fall back to an estimate for unmeasured
  rows, refining as they scroll into view (the standard "estimated size + correction" approach).
- Keep the keyboard/active path coherent with the variable offsets (scroll-active-into-view uses the
  row's real cumulative offset, not `index * itemHeight`).
- Verify with the same real-layout Playwright harness #145 added (`we:plateau/e2e/windowed-scroll.spec.ts`
  + the `__demos__/windowed-scroll` demo) — extend it with rows of mixed heights.

Acceptance: `windowed` renders the correct visible slice and a faithful scrollbar for a long list whose
rows have **different** heights, with the active-always-mounted invariant intact.

## Progress (2026-06-10)

- **Status:** resolved — built against the live Frontier UI impl
  (`fui:frontierui/blocks/droplist/Windowed.ts`), extending #145's scroll path.
- **Done:**
  - New opt-in **`measure`** mode (enables the scroll path on its own — no `itemHeight` needed; when
    both set, `measure` wins). Options: `estimatedItemHeight` (fallback for unmeasured rows, default
    `itemHeight` else 40) and `measureRow` (how a row's real height is read; defaults to `offsetHeight`,
    overridable so the path is unit-testable without a browser).
  - **Cumulative-offset prefix sum** (`#heights` cache → `#offsets`): the window is a **binary search**
    over `#offsets` (`computeVariableWindow`) instead of a `scrollTop / itemHeight` division, and spacers
    use **summed real heights** (`variableSpacerHeights`). New pure helpers `buildOffsets` /
    `computeVariableWindow` / `variableSpacerHeights` exported alongside #145's fixed-path pair.
  - **Estimate-then-correct:** rows render in flow at their natural height between offset-sized spacers;
    after mount each is measured and the cache corrected once (offsets + spacers re-painted), so the
    scrollbar refines toward the true total as rows are seen. Convergence proven in the browser.
  - **Keyboard/active path on real offsets** — `#scrollActiveIntoView` uses `#offsets[index]` +
    measured height (not `index·itemHeight`). #023 active-always-mounted holds: an off-window active row
    stays mounted out-of-flow at its real cumulative offset.
  - Render refactor: factored `#syncWindowNodes` (mount/unmount + active backstop) shared by the fixed
    `#renderScroll` and the new `#renderVariable`; #145's fixed path is behaviourally unchanged.
  - Unit tests (`fui:__tests__/behaviors.test.ts`, 28→37): 5 pure variable-math cases + 4 synthetic-layout
    integration tests (via a `measureRow` override: visible-slice-only, **windows on measured offsets
    not the uniform estimate**, active-mounted-off-window, keyboard-scrolls-far-row-into-view).
  - Real-layout proof: demo `demos/windowed-variable.{html,ts}` (500 rows, every 5th double-height) +
    `fui:blocks/droplist/__tests__/e2e/windowed-variable.spec.ts` (4 tests): visible-slice-only, **scrollbar
    converges to the true summed height (18000px = 100×60 + 400×30) after a full measure pass**,
    active-off-window stays mounted (`position:absolute`), zero console errors.
- **Gate:** FUI unit **1366 passed / 7 skipped (88 files)**, windowed e2e **10/10** (fixed + variable),
  WE `check:standards` **0 errors**.

**Graduated to** `fui:frontierui/blocks/droplist/Windowed.ts` — variable/measured scroll path — measure mode; buildOffsets/computeVariableWindow; cumulative-offset binary search; fui:e2e/windowed-variable.spec.ts.
