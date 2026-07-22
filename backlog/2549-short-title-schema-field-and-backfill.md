---
bornAs: x0xy5mj
shortTitle: "shortTitle field + backfill"
kind: story
size: 3
parent: "2527"
status: open
tags: [plateau-loop, console, schema, short-title, backlog]
dateOpened: "2026-07-18"
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
