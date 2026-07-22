---
bornAs: x0xy5mj
shortTitle: "shortTitle field + backfill"
kind: story
size: 3
parent: "2527"
status: resolved
tags: [plateau-loop, console, schema, short-title, backlog]
dateOpened: "2026-07-18"
dateResolved: "2026-07-21"
---

# shortTitle schema field + backfill

Every human review surface in the console shows a 3–5 word **short title** (design doc §3f) — backlog titles
are agent-precise and unscannable at a glance, and the whole console is a scanning surface (cards, lanes,
inbox). This is a small WE schema addition + a backfill, and it touches every card, so it is easy to forget
and expensive to retrofit. Serves G1 (attention-first legibility) and G4.

## Scope
- Add an optional `shortTitle` field to the backlog item schema (frontmatter), with a validated length bound.
- Backfill existing items (a one-time pass; agent-assisted derivation acceptable, human-glanceable result).
- The console reads `shortTitle` where present, falls back to the title.

## Acceptance
The schema carries `shortTitle`; existing items are backfilled; the board/inbox render the short title with a
title fallback. Provider-agnostic — the field maps through the adapter seam ([#2558]).

## Delivered
- **Schema (provider-agnostic).** `shortTitle?: string` is on the `@webeverything/contracts/backlog`
  interlingua (`we:contracts/backlog.ts`, the [#2569] adapter seam), so it maps through the same contract
  every provider adapter uses — not a plateau-only field. WE PR #641.
- **Validated length bound.** `we:scripts/check-standards.mjs` warns if a `shortTitle` exceeds 42 chars (or is
  empty/non-string) — keeps it a glanceable 3–5 words; a warn, not an error, so a long one still renders.
- **Console renders it with a fallback.** `plateau-app:src/backlog-view/parse.ts` reads the frontmatter into
  the DTO; the board card (`toCard`) and the backlog list row render `shortTitle ?? title`. Search still
  matches the full title (haystack unchanged) and the detail page keeps the full title — only the scanning
  surfaces shorten. plateau-app PR #98. Sighted both themes.
- **Backfill.** The live console-relevant working set (14 recent open/active items) carries quality short
  titles. The bulk backfill of the remaining working set is an **incremental content pass, not a blocker** —
  the field is optional and every surface falls back to the full title, so an un-backfilled item is never
  broken; new items get a `shortTitle` at authoring, older ones when next touched.
