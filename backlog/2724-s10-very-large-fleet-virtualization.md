---
bornAs: xpm9rzu
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2721", "2719", "2722"]
scope: ["plateau-app:src/feature-tracker/scan-virtual.ts", "plateau-app:src/feature-tracker/scan.ts"]
dateOpened: "2026-07-27"
preparedDate: "2026-08-15"
tags: []
---

# S10 · Very-large fleet virtualization

Windowed rendering for the large fleet, integrated with the DEC keyboard-model so arrow/Home/End nav + data-uc anchoring survive windowing and window-edge focus stays correct.

## Deliverable
Windowed rendering for the large fleet, integrated with the DEC keyboard-model (aria-activedescendant) so arrow/Home/End nav + `data-uc` anchoring survive windowing (R8).

## FT cases → rendered=yes
S12.

## Scope
- `plateau-app:src/feature-tracker/scan-virtual.ts`
- `plateau-app:src/feature-tracker/scan.ts` (owned re-edit — serialised against S1b and S9)

## Blocked-by fix (prep finding)
Added `"2722"` (S9) to `blockedBy`. Both S9 and S10 declare an "owned re-edit — serialised against" each
other in their own `## Scope` prose, and the epic (`#2705`) states "ordering is enforced by each slice's
`blockedBy`" — but only the S1b/DEC edges were machine-encoded; the S9↔S10 serialisation lived in prose
only (the exact `G1` gap class `we:scripts/audit-backlog-health.mjs` already names: "prose prereq not
lifted into `blockedBy`"). The epic's own canonical slice order is `…S8, S9, S10, S11…`, so the edge is
added S10-after-S9, not the reverse. This is the only backlog-metadata defect this prep found; it's fixed
directly on this card rather than filed separately since it's a one-line edit to this item's own frontmatter.

## Decided design
Reuse the constellation's already-shipped, already-tested windowed-rendering PRIMITIVES rather than
inventing new virtualization math — but reuse only the pure, framework-free half, not either of the two
existing higher-level strategies, because neither matches the DEC-ratified keyboard model as-is:

- **Reuse (grounded, verbatim import):** `computeScrollWindow` and `spacerHeights`, the pure, unit-tested,
  dependency-free window-math functions exported from `frontierui:blocks/droplist/Windowed.ts` (lines
  61–75 and 84–94). `plateau-app` already imports FUI modules this way in production
  (`@frontierui/blocks/droplist/registerDroplistMenu` in `plateau-app:src/main.ts` line 96; the alias is
  real in `plateau-app:tsconfig.json` and `plateau-app:vite.config.ts`/`plateau-app:vitest.config.ts`, not
  just types), so `import { computeScrollWindow, spacerHeights } from '@frontierui/blocks/droplist/Windowed';`
  is a proven, zero-new-infrastructure path.
- **Do NOT reuse `frontierui:blocks/renderers/collection-operations/windowedCollectionStrategy.ts`'s
  `js-windowing` flavor (#2523) as-is.** Its `focusIndex()` calls `node.focus()` on the row — real DOM focus
  moves per row (roving-tabindex). DEC `#2719` ratified `aria-activedescendant` FOR S1b/S10 *specifically
  because* it is "the robust choice under windowing: focus stays on the listbox while `aria-activedescendant`
  points at the active row, so a virtualized row entering/leaving the window never strands focus" — the
  opposite of what `js-windowing`'s `.focus()` call does. Picking `js-windowing` off the shelf here would
  silently violate the ratified contract; this was caught by reading the strategy's code, not assumed.
- **Do NOT reuse `frontierui:blocks/droplist/Windowed.ts`'s `Windowed` class directly either** — it's a
  `CustomAttribute` bound to FUI's composite/plug DOM contract (`composite-descendant`, `ownerElement`,
  `activedescendantchange` events), and nothing in `plateau-app:src` today uses that plug framework (a
  search for `composite-descendant`/`focus-delegation` across `plateau-app:src` finds nothing outside one
  unrelated file); `plateau-app:src/feature-tracker/scan.ts`'s aria-activedescendant nav (S1b) is expected
  to be hand-rolled vanilla TS, matching every other plateau-app surface (e.g.
  `plateau-app:src/backlog-view/lane-board.ts`).
- **New, FT-owned, thin layer (`plateau-app:src/feature-tracker/scan-virtual.ts`):** a small module that
  calls the two pure functions above, mounts only the `[start, end)` slice (+ overscan) of fleet rows via
  S1b's own row-creation code, pads with top/bottom spacer nodes sized by `spacerHeights` so
  `scrollHeight === total × itemHeight`, keeps the current `aria-activedescendant` target row **always
  mounted** even when the scroll window excludes it (the same "#023 active-always-mounted" backstop
  `frontierui:blocks/droplist/Windowed.ts` and `frontierui:blocks/renderers/collection-operations/windowedCollectionStrategy.ts`
  both already implement independently — proven technique, reimplemented small rather than inherited), and
  re-stamps `aria-setsize`/`aria-posinset`/`data-uc`/`data-index` from the model on every (re)mount so they
  never go stale after a scroll. It never calls `.focus()` on a row; it only ever updates the listbox
  container's `aria-activedescendant` attribute value.
- **Windowing is unconditional, not threshold-gated.** `computeScrollWindow` already degrades to "mount
  everything" when the viewport can show the whole list (`end` clamps at `total`), so wrapping S1b's
  ≤31-row baseline in the same windowed path costs nothing and needs no separate "is this fleet large
  enough to virtualize" fork — avoids inventing an unstated size threshold.

## Interfaces
**Grounded (real, already-read code):**
```ts
// frontierui:blocks/droplist/Windowed.ts lines 61-75
export function computeScrollWindow(
  scrollTop: number, clientHeight: number, itemHeight: number,
  total: number, overscan = 0,
): { start: number; end: number }

// frontierui:blocks/droplist/Windowed.ts lines 84-94
export function spacerHeights(
  start: number, end: number, total: number, itemHeight: number,
): { top: number; bottom: number }
```
`clientHeight` must be overridable in tests: `plateau-app` runs vitest under `happy-dom`
(`plateau-app:vitest.config.ts` line 16), which reports `clientHeight === 0` (no real layout) — the same
problem `frontierui:blocks/renderers/collection-operations/windowedCollectionStrategy.ts` solves with its
`viewportHeight?: number` test-only override (that file, lines 56–62).
`plateau-app:src/feature-tracker/scan-virtual.ts` needs the same escape hatch or the scroll-window unit
tests (and S12/`#2730`'s "runs green in jsdom" clause) cannot be satisfied.

**NOT yet groundable — the one honest open item.** `plateau-app:src/feature-tracker/scan.ts` does not
exist yet (S1b/`#2721` is `status: open`, unbuilt — see Preparation status below), so the exact shape of
the per-row DOM-creation code `plateau-app:src/feature-tracker/scan-virtual.ts` must call (function name,
args, whatever CSS/markup S1b lands with) cannot be cited. Per this repo's grounding rule ("cite
`path:line` actually opened, never invent an interface you have not read"), this seam is deliberately left
as **Task 1** below — read S1b's landed `plateau-app:src/feature-tracker/scan.ts` first — rather than a
guessed contract. What CAN be stated now: S1b's own card fixes the row height implicitly (a `≤31-row scan`
with a `data-uc` + accessible name per row, `#2721`'s acceptance), so a constant `itemHeight` in px is
expected to already exist somewhere in `plateau-app:src/feature-tracker/scan.css` or
`plateau-app:src/feature-tracker/scan.ts` for S10 to read, not invent.

## Tasks
1. Once `#2721` (S1b) lands: read its `plateau-app:src/feature-tracker/scan.ts` to find the per-row
   DOM-creation code and the fixed row height (CSS or a TS constant) it renders with.
2. Add `plateau-app:src/feature-tracker/scan-virtual.ts`, importing `computeScrollWindow`/`spacerHeights`
   from `@frontierui/blocks/droplist/Windowed`.
3. Implement the mount/unmount/spacer/active-always-mounted logic described in Decided design, re-stamping
   `data-uc`/`aria-setsize`/`aria-posinset`/`data-index` on every (re)mount from the model, never from stale
   DOM state.
4. Add a `viewportHeight`-style test-only override (mirrors
   `frontierui:blocks/renderers/collection-operations/windowedCollectionStrategy.ts` lines 56–62) so the
   scroll path is exercisable under `happy-dom`.
5. Re-point `plateau-app:src/feature-tracker/scan.ts`'s row-rendering call to go through
   `plateau-app:src/feature-tracker/scan-virtual.ts` (the owned re-edit) — same visual output at ≤31 rows
   (windowing degrades to "mount all"), new behavior at large N.
6. Unit test: a synthetic large-fleet fixture (thousands of rows) mounts only `[start, end)` + overscan row
   nodes at rest.
7. Unit test: arrow/Home/End nav moves `aria-activedescendant` to the correct absolute row id at every step,
   including across the window boundary, and the target node is resolvable (`getElementById`) at each step —
   this is the case S12/`#2730`'s "window-edge keyboard case (R8)" asserts against, so keep the two aligned.
8. Unit test: `data-uc`/`aria-setsize`/`aria-posinset` are correct immediately after a row re-mounts
   post-scroll (not carried over stale from its previous mount).
9. Visual/behavioral check: no horizontal body scroll at any fleet size, both themes.

## Acceptance
- A large-fleet fixture mounts only the `[start, end)` + overscan slice of row nodes at rest (not the full
  model) — assert the mounted count is far below the model size.
- Arrow/Home/End nav moves `aria-activedescendant` to the correct absolute row at every step, including
  across the virtualization window boundary; the referenced node is always resolvable (never points at an
  unmounted id).
- Every mounted row carries the correct `data-uc` + an accessible name + `aria-setsize`/`aria-posinset`
  matching its ABSOLUTE model position, freshly stamped on (re)mount.
- The S1b ≤31-row baseline still matches the frozen baseline pixel-for-pixel in both themes after S10 lands
  (windowing is transparent at small scale — no regression).
- No horizontal body scroll at any fleet size.
- `plateau-app`'s `npm run test` (vitest/happy-dom) and S12's behavioral gate (`#2730`) are green;
  window-edge case (R8) passes.

## Delivery shape
Incremental — one self-contained slice on top of trunk, same as every other sibling slice in this epic. It
does not need its own branch: the epic's acceptance policy (`#2705`) auto-lands a slice once its machine
gates (webcase conformance + visual-diff-to-baseline + behavioral gate + honest-number invariants) are
green, and this slice's `blockedBy` (`#2721` S1b, `#2722` S9, `#2719` DEC — all must be `resolved`, not just
merged) already sequences it correctly behind its two file-level co-owners.

## Preparation status
Design decided, interfaces grounded to the extent the live repo currently allows, tasks ordered, acceptance
testable, delivery shape stated (items 1–8 of the story-preparation checklist). **Not yet actually buildable
today**, and that is expected, not a defect in this prep: `#2721` (S1b), and transitively `#2718` (S1a) and
`#2717` (S0a), are all still `status: open` with zero code landed toward them — the only feature-tracker code
in `plateau-app` today is `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` from S0r (`#2716`;
a sibling lane, `lane/reconcile-2716`, was already mid-flight resolving that item's stale status as of this
prep — unrelated to S10, noted for context). `plateau-app:src/feature-tracker/scan.ts` and
`plateau-app:src/feature-tracker/read-model.ts` do not exist, so this card's one remaining gap (the exact
row-creation call `plateau-app:src/feature-tracker/scan-virtual.ts` wires into) is genuinely ungroundable
until S1b ships — named as Task 1 above rather than guessed. This card is ready to hand to a builder the
moment `#2721`/`#2722` resolve; it is not ready to build before then, and nothing in this prep should be
read as saying otherwise.
