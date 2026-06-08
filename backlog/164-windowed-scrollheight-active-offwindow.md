---
type: issue
workItem: task
parent: "137"
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-07"
dateResolved: "2026-06-07"
tags: [droplist, windowed, virtualization, scroll, a11y]
relatedProject: webblocks
crossRef: { url: /backlog/145-windowed-scroll-height-driven-path/, label: "#145 windowed scroll path" }
---

# `windowed`: account for the always-mounted active row in the spacer height

#145 keeps the active option mounted even when it scrolls entirely outside the window slice (the #023
active-always-mounted invariant). When that happens the active row is an EXTRA mounted element the
spacer math doesn't account for: `spacerHeights()` sizes the top/bottom spacers from `[start, end)`
only, so total `scrollHeight` overshoots the true model height by one `itemHeight` while the active row
sits off-window.

It's cosmetic — the active item is usually scrolled into view (keyboard moves call
`#scrollActiveIntoView`), so the off-window case is transient and the drift is a single row — which is
why #145 shipped without it. But it means the scrollbar is momentarily ~one row "too tall" when the
focused option is far from the viewport.

- When the active row is outside `[start, end)`, subtract its `itemHeight` from the appropriate spacer
  (top if the active index is above the window, bottom if below) so `scrollHeight` stays exact.
- Position the off-window active row so it doesn't visually overlap a spacer region (it's currently
  rendered inline at the slice edge; consider `position: absolute` translate or visually-hidden while
  off-window, since it exists only to keep `aria-activedescendant` resolvable).
- Add a real-layout assertion to `plateau/e2e/windowed-scroll.spec.ts`: with the active row scrolled far
  off-screen, `scrollHeight === total * itemHeight` exactly.

Acceptance: `scrollHeight` equals the full model height even while the always-mounted active row is
outside the visible window.

## Resolution — spacer subtracts the off-window active row

Fixed in `plateau/src/blocks/attributes/Windowed.ts`:

- **Pure math.** `spacerHeights()` gained an optional `activeIndex`. When the active row sits outside
  `[start, end)` it is an extra in-flow row the spacer already reserves a slot for (double-counted), so
  one `itemHeight` is subtracted from the spacer on its side — top when the active row is above the
  window, bottom when below. Inside the window (or no active row) nothing changes. `#render` now passes
  `this.#activeIndex` through. Result: `scrollHeight` stays exactly `total * itemHeight`.
- **Visual hook.** The off-window active row (rendered inline at the slice edge purely to keep
  `aria-activedescendant` resolvable) is flagged `data-windowed-active-offwindow` while off-window and
  cleared when it scrolls back in, so a stylesheet can lift it out of visual flow. Kept it **in flow**
  (not `position:absolute`) deliberately — that keeps the spacer math exact without assuming a
  positioned ancestor; the row already sits one past the overscan edge, effectively off-screen. The
  marker is an available polish hook, not a deferred requirement.

**Tests (all green):**
- `Windowed.test.ts` — added pure `spacerHeights` cases (active below → bottom spacer −1 row; active
  above → top spacer −1 row; active inside → unchanged) and extended the scroll-path off-window test to
  assert `top + mounted*ITEM + bottom === total*ITEM` and the marker toggles. 22/22 pass.
- `e2e/windowed-scroll.spec.ts` — the real-layout "active row stays mounted far out of view" test now
  asserts `scrollHeight === TOTAL * ITEM` exactly (would have been `(TOTAL+1)*ITEM` before). 5/5 pass.

Typecheck clean for the changed file (the 2 pre-existing `tsc` errors are in unrelated
`proposals/` / `QueryProperty.ts`). No new leftovers — the visual hook is in place, acceptance met.
