---
bornAs: xo9wnlp
kind: story
size: 5
parent: "2555"
status: active
scaffoldedBy: "slice-2555"
dateScaffolded: "2026-07-20"
dateOpened: "2026-07-20"
tags: [plateau-loop, console, console-board, board-shell, lane-windowing, slice-2555]
---

# Console board shell + lane windowing

> **⚠ ALREADY DELIVERED — resolve as graduated (status change owed, not done here).** This slice's entire
> scope + acceptance already landed in `plateau-app:src/backlog-view/lane-board.ts`, whose own docstring
> reads *"THIS FILE'S SLICE (#2555, first sub-slice — board shell + lane windowing)"*. Landed via
> plateau-app commits `a87b466` ("slice 1: board shell + lane windowing"), `05db340` (conformance/a11y
> fixes), `4b7206b` (idempotent mount); wired into `plateau-app:src/main.ts` at `/console-board`
> (`mountLaneBoard`, lines 57/407/723). It delivers every bullet below — data-driven `BOARD` fixture, pure
> resize-driven windowing maths, collapse-to-strips (state icon + rotated name + count), `‹ ›` swap, both
> themes, a11y. **Action owed:** resolve/graduate this item to that path and **re-root the DAG at
> [#2584]** (its `blockedBy` on this already-built shell is satisfied). This note is a correction only —
> the status splice is out of scope for this edit pass.

The container every other board slice renders into: the bare-on-the-page workbench shell (design-record
§3i v22–v24) — lanes as vertical agent-slot columns, sticky lane headers that form the NOW line at the
viewport top, both docks sticky, and a data-driven `BOARD`/`FEATURES`/`READY` fixture + renderer so a long
multi-hour queue is cheap to fixture. This is the scaffold only; cards, zones, spans, and actions land in
the sibling slices.

## Scope
- **Lane columns + NOW line.** Render N lane columns from a board fixture; sticky lane headers whose lower
  border forms the single NOW line across all columns (§3i v20–v24). Each header carries the stream name +
  a scope chip.
- **Lane windowing — never horizontal scroll (design-record §3i v22, a hard rule).** Lanes that do not fit
  the viewport collapse to thin strips (state icon + rotated name + count), swappable into the window via
  click or `‹ ›`; the window is recomputed on resize. The collapsed-strip icon shows lane STATE
  (run/pause/review/decision/done/drain/idle/free), never an identity mascot (the ratified icon grammar,
  design-record §6 2026-07-17). Cite the `windowed-collection` dimension from [#2523] rather than inventing
  a windowing rule.
- **Dock frames.** Left + right dock shells with chrome (grip · collapse · menu) per the workbench pivot
  (§3i v20) — empty frames here; the Features/Ready/composer content is filled by the action + leverage
  slices.
- **Data-driven.** The board is rendered from a fixture module (BOARD/FEATURES/READY shape), not hardcoded
  markup, so downstream slices extend the fixture, not the renderer.

## Where the code goes (locus)
- Delivered as `plateau-app:src/backlog-view/lane-board.ts` (a plateau-app board view under
  `plateau-app:src/backlog-view/`, sibling of the existing `plateau-app:src/backlog-view/backlog-view.ts`).
  The view codes only against the read port (the [#2558] R2 boundary) — no bare CLI / disk / `gh` from a
  rendering path.
- The design record is the cited source: `plateau-app:docs/backlog-console-design.md` §3i (the lane board),
  §6 (the ratified icon/color grammar). The v68 mock is the UI-design input, not code to port verbatim.

## Out of scope (other slices)
- Rendering the card states → [#2584]. The delivery-horizon geometry → [#2586]. Scope-lease zones →
  [#2589]. Cross-lane spans + leverage → [#2585]. Operator actions → [#2588]. Write affordances →
  [#2587].

## Acceptance
- The board renders lane columns from a fixture, with sticky headers forming a single NOW line and left +
  right dock frames.
- On a narrow viewport the board **never scrolls horizontally**: overflow lanes collapse to strips (state
  icon + rotated name + count) and swap into the window on `‹ ›` / click, recomputed on resize.
- The shell is data-driven (a BOARD fixture feeds the renderer), both-theme, and `plateau-app`'s gate
  (`npm test`) + `we:` `check:standards` pass.
