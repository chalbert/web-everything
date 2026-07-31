---
bornAs: xhxrsur
kind: story
size: 3
parent: "2555"
status: resolved
blockedBy: ["2789"]
dateOpened: "2026-07-27"
dateResolved: "2026-07-31"
scope:
  - plateau-app:src/backlog-view/lane-board.ts
  - plateau-app:src/backlog-view/lane-board.css
tags: [plateau-loop, console, console-board, cross-lane-spans, dag, canonical-2554, slice-2555]
---

# Console board multi-lease waiters render as the ratified single-box `wait` card

Delivered in [chalbert/plateau-app#123](https://github.com/chalbert/plateau-app/pull/123) — the PR title is
stale (leftover "cross-lane span bar" wording from a bad dispatch brief), but the merged code delivers the
reversed requirement: `spanToCard`/`renderSpanCards` in `plateau-app:src/backlog-view/lane-board.ts` render a
multi-lease waiter as the single ratified `wait` card (waits-purple, waypoints, inline `⌃` lease chips), and
`plateau-app:src/backlog-view/cross-lane-spans.ts` records the docked `.lb-spandock` bar as superseded — no
span bar ships.

An item that waits on more than one lease can't sit in a single column. **Reversed 2026-07-28** off the
superseded v68 baseline: the canonical §6/#2554 board has **no docked full-width "cross-lane spans" band** —
it renders a multi-lease waiter as the ratified single-box **`wait`** card (waits-purple, waypoints icon,
"waits #id"). The original story chased v68's full-width span *bar* and treated "renders as a card" as the bug;
the committee found that inverts the canonical wait-card grammar (a card **is** the correct treatment).

## Canonical alignment (what changed — a genuine reversal)
- **No span band.** Drop the docked full-width `CROSS-LANE SPANS` region; canon is fixed ~300px columns + one
  horizon, nothing docked below (`center-multi-lane`).
- **One box, not a bar.** A full-width span bar is a second box grammar; canon mandates the ONE ratified card
  box for all cards ([#2789] `card-single-box`). Express the waiter as the `wait` card variant.
- **Waits = purple, not teal.** A normal (waiting) span colored teal reads as *leverage*; the fixed state→color
  map puts wait = waits purple ([#2795] `tokens-state-color-map`). A forced/degraded waiter is amber only if
  it is genuinely the human/degraded state.

## Scope
- Render a multi-lease waiter as the `wait` card: waypoints icon, "waits #id", the lanes it waits on named
  inline (chips), "starts when all free" copy — inside the single ratified box, waits-purple.
- Forced/degraded variant uses the human/amber state with its conflict-resolution copy — via the state grammar,
  not a bespoke bar.
- Keep it data-driven from the `SPANS` fixture / read-model.
- **If a distinct docked span region is genuinely wanted**, that is a change to the ratified grammar: refile it
  as a new spec decision that adds a `span-region` specKey to the canonical checklist first — not a v68 bugfix.

## Where the code goes (locus)
`plateau-app:src/backlog-view/lane-board.ts` (the existing `SPANS` render) reusing the [#2789] card box.

## Acceptance
A multi-lease waiter renders as the single ratified `wait` card (waits-purple, waypoints, "waits #id", inline
lane chips), with a human/amber forced variant — no full-width docked span bar. Judged against the
**ratified** §6/#2554 wait-card grammar (binding now); the canonical **visual baseline** that supersedes v68
`plateau-app:tests/visual/baselines/board.png` is the *pending* pixel oracle [#2796] freezes, so the
baseline comparison is **gated on that flip** — until [#2796] lands, verify against the ratified grammar +
fixtures, not against a canonical baseline that does not yet exist. Both themes; `plateau-app` `npm test` +
`we:` `check:standards` pass.
