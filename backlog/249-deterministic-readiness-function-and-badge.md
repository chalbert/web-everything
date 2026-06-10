---
type: idea
status: resolved
workItem: story
size: 3
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: none
blockedBy: ["248"]
tags: [backlog, tooling, determinism, ui]
relatedReport: docs/agent/backlog-workflow.md
---

# Compute agent-readiness as a deterministic pure function and show it on `/backlog/`

Readiness ("could an agent open a PR for this today?") is currently a fuzzy
judgment the `next-backlog-item` skill makes per item, re-derived every time and
invisible on the UI. Once dependencies are structured (#248), readiness becomes a
**pure function of frontmatter** — no LLM, same input → same tier every build — so
compute it in the loader and render it as a tier chip + filter on the backlog index.

Depends on **#248** (needs `blockedBy` to evaluate the prerequisite signal
deterministically).

## The deterministic function

The four-signal rubric in [docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md)
splits into a deterministic core and two prose-only signals that cannot be made
deterministic without lifting them to data:

```
tierA(item) =
     item.status === "open"
  && item.type in {issue, idea}            // type gate — already structured
  && item.blockers.every(b => b.resolved)  // prerequisite gate — from #248
```

- `type` and `blockedBy` are structured → fully deterministic.
- **Body verbs** and **"is the `relatedReport` a settled plan"** stay prose-inferred,
  so the badge is labelled an **agent-ready *hint*, not a guarantee** — Tier A here
  means "nothing structural blocks it," which the LLM selection pass still refines.

## Build

- [src/_data/backlog.js](src/_data/backlog.js): add a derived `tier` (`A`/`B`/`C`)
  per the function above; `B` = `type: decision` that states a recommendation, `C` =
  everything else not-ready.
- [src/backlog.njk](src/backlog.njk): render `tier` as a chip on each card and add a
  filter facet ("agent-ready") alongside the existing type/status filters.

## Acceptance criteria

- `tier` is computed in the loader from structured fields only (no body-text parsing
  in the deterministic path); identical across rebuilds.
- `/backlog/` shows a tier chip per item and can filter to Tier A.
- The chip's tooltip/label states it's a heuristic hint, not authoritative.

## Outcome (resolved 2026-06-09)

- **Loader** ([src/_data/backlog.js](src/_data/backlog.js)): derives `item.tier` (`A`/`B`/`C`) right
  after the `blockers` array is resolved, from **structured fields only** — `status`, `type`, and each
  blocker's `status` — so there is no body-text parsing in the path and the result is identical across
  rebuilds (verified by a double-build diff). The two prose signals from the rubric (body verbs, whether
  the `relatedReport` is a settled plan) are deliberately **not** read, which is why the tier is an
  agent-ready *hint* the LLM selection pass still refines.
- **Tier scope decision — only `open` items carry a tier.** For `active`/`resolved`/`parked` items
  readiness is moot (already claimed, done, or shelved), so they get `tier === undefined` → no chip and
  no tier-filter effect. This keeps the badge meaning crisp ("could an agent *start* this now?") instead
  of stamping a misleading "Not ready" on finished work.
  - A — `issue`/`idea` with every blocker `resolved` (nothing structural blocks a start).
  - B — a `decision` (the "states a recommendation" nuance is prose, so the structural proxy is the type).
  - C — everything else open: an `issue`/`idea` with an unresolved blocker, or a `review`.
- **Index UI** ([src/backlog.njk](src/backlog.njk)): a `tierBadge` macro renders the chip in each card's
  badge row (green `Agent-ready` / amber `Decision-ready` / slate `Not ready`), with a `title` tooltip
  stating it's a heuristic from structured fields, **not authoritative**. A new "agent-readiness" filter
  group (`data-tier-chip`) sits alongside status/type/size; toggling off B and C filters to Tier A.
- **Filter JS** ([src/assets/js/home-display.js](src/assets/js/home-display.js)): wired `data-tier-chip`
  parallel to the existing size facet (own localStorage key, default all-on). A card with no `data-tier`
  (non-open) always passes the tier facet, so filtering to Tier A narrows the open pool without hiding
  active/resolved cards.
- **Verified:** standalone build shows 77 A / 23 B / 7 C across 107 open items (135 non-open carry no
  tier); spot-checked that blocked open items (#087 → open #088, #250 → active #249, #088 → open #081)
  all land in **C**, confirming the blocker gate. `check:standards` green (242 items). The successor
  #250 (deterministic fix algorithm) is now unblocked on its #249 dependency.
