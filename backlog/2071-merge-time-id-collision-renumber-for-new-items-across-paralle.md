---
kind: story
size: 5
status: resolved
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: [workflow, batch, backlog, id-allocation, parallel, merge, tooling]
formerSlugs: []
---

# Merge-time id-collision renumber for new items across parallel lanes

Parallel `/workflow` lanes provably partition **edits to existing files**, but they do **not** partition **id
allocation for newly-created backlog items**. A new item's id is derived at author time as `max(existing) + 1` from
each lane's own base view; two lanes branching from the same base both compute the same next id, and neither can see
the other's not-yet-existing file. When both land, they collide on `#NNN` — the disjointness checker is blind to it
because the new file's path is in no lane's declared write-set at partition time.

Hit live in `batch-2026-07-01-1965-2052`: `#2068` was allocated by two lanes at once —
`2068-reconcile-fui-runtime-directive-markers` (from #2030 SSR work) and a gate item (from the #2061 resolve),
both branching from a base whose max id was 2067. The collision surfaced only at the standards gate
(`ids must be unique`) and as an 11ty output conflict (`we:_site/backlog/2068/index.html` written twice), after both
had already landed on `main`. The gate item was yielded to #2070, but by hand — the raw mechanisms are (correctly)
guarded: `git mv` is blocked as a renumber, `rm` is blocked as a backlog delete.

## Acceptance
- The batch landing/merge step detects a **new-item `#NNN` collision** (two files claiming the same id, neither the
  ancestor of the other) and **auto-yields the later-landing one** to the next free id — the sanctioned
  "newer yields" rule (backlog NNN ids are immutable), done as a refile, not a `git mv`.
- The renumber **rewrites every inbound reference** to the yielded id — `#NNN` short-refs, `/backlog/NNN/` URLs,
  `parent:`/`blockedBy:` frontmatter edges, and the redirect generator (`we:src/backlog-redirects.njk`) — so no link
  is left dangling. (This is the load-bearing half: renumbering without a full reference sweep is worse than the
  collision.)
- Emits a summary of what was renumbered and which refs were rewritten; leaves the standards gate green.
- Idempotent: a second run with no collisions is a no-op.

## Boundaries
- Only new-item id collisions — never touches an id that both lanes inherited from a shared ancestor (that is a real
  edit conflict, not an allocation race).
- Does not renumber items that predate the batch base.

## Lineage
Surfaced during the #1989 decision session (2026-07-01) when the `#2068` collision blocked the gate. Relates to the
lane-partition model (parallel `/workflow` lanes) and the backlog NNN-immutability rule.
