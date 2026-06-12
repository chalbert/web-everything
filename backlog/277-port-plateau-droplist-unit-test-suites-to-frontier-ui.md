---
type: issue
workItem: story
size: 3
parent: "193"
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: []
---

# Port plateau droplist unit-test suites to Frontier UI

Frontier UI carried a focused droplist test set during the migration (`frontierui/blocks/droplist/__tests__/`);
the plateau original had richer suites. Port them for full parity so behavior coverage doesn't regress
versus the abandoned plateau prototype.

Split from [#193](/backlog/193-droplist-frontierui-migration-followups/) (bullet 5).

## Suites to port

- **Filter** — async respond/reject **stale-guard** (out-of-order async responses dropped).
- **FocusDelegation / Selection** — the split-responsibility cases.
- **Anchor** — the open/dismiss matrix.
- **Anchored** — delegation to the resolved positioning strategy (complements the strategy unit tests
  already in `frontierui/blocks/droplist/positioning/__tests__/`).

Do **not** consult the plateau repo as a model (it is abandoned); re-derive the cases against Frontier
UI's current behaviors. Acceptance: the listed cases exist and pass in Frontier UI.

## Progress

**Resolved 2026-06-11.** Ported the richer suites — re-derived against Frontier UI's current
behaviors (plateau never consulted) — into a new
`frontierui/blocks/droplist/__tests__/ported-suites.test.ts` (12 tests), complementing the focused
`behaviors.test.ts` and the positioning `strategies.test.ts` rather than duplicating them:

- **Filter — async stale-SETTLE guard** (the explicit gap, symmetric to the stale-*reject* already
  in `behaviors.test.ts`): two superseded queries' `respond` callbacks captured; settling the stale
  one renders nothing / announces nothing / leaves the live request `aria-busy`; the live `respond`
  then renders + announces + clears busy.
- **Anchored — delegation to the resolved positioning strategy (#149)**: spies the resolved strategy's
  `place`, asserts `anchored` hands it the full declared intent (placement + flip/shift + trigger +
  surface + anchorName), reflects `data-anchored-placement` / `data-positioning-strategy` /
  `strategyName`, tears down on disconnect, and engages **no** strategy when there is no trigger.
- **Anchor — open/dismiss matrix**: starts collapsed; an open key (ArrowDown) opens; Escape dismisses;
  a surface `selectionchange` commit dismisses when `dismissOnCommit` is on and stays open when off.
- **FocusDelegation / Selection — split responsibility**: `selectionFollowsFocus:false` → a move
  shifts `aria-activedescendant` but does NOT commit (Enter does); `selectionFollowsFocus:true` → a
  move commits (selection follows focus); FocusDelegation wraps at the ends by default and clamps with
  `nowrap` — focus movement and selection are separate behaviors coupled only through the DOM.

**Test-authoring notes (re-derivation footguns hit & fixed):** asserting a `place()` call's DOM-node
args with `toMatchObject` recursed the circular DOM and OOM'd the vitest worker — switched to `toBe`
reference equality; and setting a behavior's `options` wholesale clobbers its class-default
(`dismissOnCommit`) — pass the flag explicitly. Full droplist suite green: **77 tests** (37 behaviors
+ 12 ported + 13 AutoComplete + 15 strategies). WE `check:standards` green. Last bullet (5) of the
#193 droplist-migration follow-ups.
