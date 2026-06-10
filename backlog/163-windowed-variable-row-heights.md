---
type: idea
workItem: story
size: 5
parent: "137"
status: open
blockedBy: ["145"]
dateOpened: "2026-06-07"
tags: [droplist, windowed, virtualization, scroll, layout]
relatedProject: webblocks
crossRef: { url: /backlog/145-windowed-scroll-height-driven-path/, label: "#145 windowed scroll path" }
---

# Add variable per-row height support to `windowed`

> **Premise corrected (2026-06-10, after #145's live build).** #145 shipped against the live Frontier
> UI impl (`frontierui/blocks/droplist/Windowed.ts`) with a **fixed `itemHeight` option only** — there
> is *no* measured-uniform fallback (the `#itemHeightPx()` measure-one-row path described below was the
> abandoned plateau design, never built live). So this item also covers the *measured* case from
> scratch. Generalise the pure helpers `computeScrollWindow` / `spacerHeights`, and extend the
> real-layout harness **`frontierui/blocks/droplist/__tests__/e2e/windowed-scroll.spec.ts` +
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
- Verify with the same real-layout Playwright harness #145 added (`plateau/e2e/windowed-scroll.spec.ts`
  + the `__demos__/windowed-scroll` demo) — extend it with rows of mixed heights.

Acceptance: `windowed` renders the correct visible slice and a faithful scrollbar for a long list whose
rows have **different** heights, with the active-always-mounted invariant intact.
