---
kind: story
size: 3
parent: "2505"
status: open
tags: [plateau-loop, console, backlog-view, program-view, triage]
dateOpened: "2026-07-22"
---

# Backlog screen: gating-status lens + authored blockedReason — show why an item is stuck, grouped by area

The `/backlog` reader (`plateau:src/backlog-view/backlog-view.ts`) filters, sorts, and groups — but always over
**raw status** (open vs resolved) plus the live PR pills. It never answers the question a triager actually asks:
**why isn't this done?** A hand-made status table (grouped by area, each item chipped ready / gated / needs-decision /
merge-critical, with a one-line blocker) was visibly more useful for planning than the current screen — this item
brings that lens into the product.

## Why now
Surfaced 2026-07-22: an operator found an authored program-view table a *better backlog* than the `/backlog`
screen. The gap is a **derived gating status + a plain-language blocker reason**, neither of which the screen
computes today.

## Scope
- **Derived gating status** per item — computed from data where possible: `ready` (open, unblocked),
  `blocked` (a `blockedBy` names a still-open item), `needs-decision` (`kind: decision`, or blocked by one),
  `resolved`. These need no new field.
- **Authored `blockedReason` (+ a `gating` hint)** — the part that can't be derived: "gated on an unbuilt
  foundation", "waiting on a ruling", "merge-critical". A short optional frontmatter field an author writes when
  parking an item on something not-yet-built; the screen shows it verbatim on the card and as the chip label.
  (Mechanical statuses above never need it; only genuinely-gated items do.)
- **Area grouping** — group the list by a curated area cross-cut (console / delivery machinery / decisions /
  adjacent), not just by a single frontmatter field. Likely a small area map keyed off parent-epic / tags.
- Fits the existing arrange bar (#2518) as a new "group by: area" + "show: gating" mode; reuses the shipped
  filter/sort/render — a lens over the current screen, not a rewrite.

## Out of scope
- The lane dashboard (`/console-board`) — this is the `/backlog` reader specifically.
- Auto-inferring "gated on unbuilt X" from nothing — that judgment is authored via `blockedReason`, not guessed.

## Acceptance
`/backlog` can group by area and, per item, shows a gating chip (ready / blocked / needs-decision / gated /
resolved) with the authored `blockedReason` when present; the mechanical statuses derive with no new authoring;
`plateau` `npm test` + `we:` `check:standards` pass; both themes render.
