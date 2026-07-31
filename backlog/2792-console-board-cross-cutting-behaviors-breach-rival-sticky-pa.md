---
bornAs: x9hg7qz
kind: story
size: 3
parent: "2555"
status: resolved
dateOpened: "2026-07-28"
dateStarted: "2026-07-31"
dateResolved: "2026-07-31"
graduatedTo: none
scope:
  - plateau-app:src/backlog-view/lane-board.ts
  - plateau-app:src/backlog-view/lane-board.css
  - plateau-app:src/backlog-view/composer.ts
  - plateau-app:src/backlog-view/cross-lane-spans.ts
tags: [plateau-loop, console, console-board, scope-lease, a11y, canonical-2554, slice-2555]
---

# Console board cross-cutting behaviors — breach/rival/sticky/panel-consistency

Delivered in [chalbert/plateau-app#127](https://github.com/chalbert/plateau-app/pull/127).

Deliver the canonical cross-cutting behaviors the legend [#2794] promises but no surface yet enforces. The
committee found `xcut-breach`, `xcut-rival`, `xcut-sticky`, and `xcut-panel-consistency` **UNOWNED** (`xcut-lease`
is covered by [#2589]/[#2712]; `xcut-windowing` by [#2713]).

## Scope
- **Scope breach** — a build that wrote outside its lease renders as a **paused human card** (amber) carrying a
  **Resolve** action, resolved at drain (`xcut-breach`; reads [#2789] human state + [#2551] inspector deep-link).
- **✕ rival** — two lanes touching the same files with **no dependency** are marked rivals: "same files, no
  dependency — order is your choice", surfaced so the operator sequences them (`xcut-rival`).
- **Sticky chrome** — the left + right side columns are sticky, and lane headers stay pinned as the center
  scrolls (`xcut-sticky`).
- **Panel consistency** — every panel (new-work, legend, lane pool, ready-queue) shares one chrome grammar:
  grip · title · count · collapse · menu (`xcut-panel-consistency` — the shared seam [#2790]/[#2794]/
  [#2791] all conform to).

## Where the code goes (locus)
`plateau-app:src/backlog-view/lane-board.ts` panel + lane-header render;
`plateau-app:src/backlog-view/lane-board.css` sticky geometry.

## Acceptance
A breached build renders as a paused amber human card with a Resolve action; rivals are marked with the
order-is-your-choice cue; side columns + lane headers stay pinned on scroll; all panels share one chrome
grammar — matching the canonical §6/#2554 artifact. Both themes; `plateau-app` `npm test` + `we:`
`check:standards` pass.

## Resolution (2026-07-31)
STEP-0 audit against fresh `plateau-app` `origin/main` found the four behaviors in three different states:

- **`xcut-sticky` — already conformant, no build.** `.lb-head` (every lane head, including the panel heads)
  is `position: sticky; top: 0`, and both `.lb-leftrail` and `.lb-ready` (the right rail) are already
  `position: sticky; top: 8px`, with no clipping/overflow ancestor breaking it.
- **`xcut-rival` + `xcut-panel-consistency` — genuine gaps, built.** The rival badge glyph was `⚔`, drifted
  against the already-shipped legend key (`✕ rival`, #2794) and this item's own spec wording — fixed to `✕`.
  The New work (composer), How this board works (glossary), and Ready to queue panels lacked the canonical
  grip · title · count · collapse · menu chrome the Lane pool (#2790) introduced (as reusable
  `.lb-panel-head/-grip/-count/-collapse/-menu` classes) — extended all three to the same chrome, without
  touching the composer's #2714-pinned field content. Delivered in
  [chalbert/plateau-app#127](https://github.com/chalbert/plateau-app/pull/127).
- **`xcut-breach` — delivered AS RATIFIED, deliberately NOT built to this item's literal wording.** This
  item's own scope bullet ("paused human card (amber) carrying a Resolve action") pre-dates and conflicts
  with the later-RATIFIED `plateau-app:docs/backlog-console-design.md` §3i-A4 (2026-07-20, WE decision
  #2574, a three-lens jury ruling): UC-A4 (paused-scope-breach) stays `actor=agent, edge=none` — no amber,
  no action — by default; only `policy=ask` promotes it to a you-card, and that policy/retry signal isn't
  wired into the live scope-lease read-model at all today. Building the card's literal ask as written would
  have regressed a jury-ratified rule that postdates this item's authoring (the spec text is stale
  carry-forward from the pre-#2574 v15-era mock). Scope-breach ships exactly as `#2574` already ratified —
  no code change. The genuine remaining work (wiring `policy=ask` live + the amber Resolve card) is filed
  separately as [#xzjfj4u] so it isn't lost, and stays open/unblocking.
