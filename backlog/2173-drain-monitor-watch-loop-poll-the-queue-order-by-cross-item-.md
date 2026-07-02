---
kind: story
size: 3
parent: "2162"
status: resolved
blockedBy: ["2172"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Drain monitor/watch loop: poll the queue, order by cross-item blockedBy, drain ready couples serially

The #2162 drain's outer loop. Poll we:.claude/skills/batch-backlog-items/queued.json, resolve cross-item blockedBy order from each we:.lane-manifest.json, drain each ready couple serially via the #2172 drain-one-couple core, and regenerate WE derived artifacts once at the end (the Phase 4c relocation). Human-launched (watch or one-shot).

## Progress

Added the `watch` / `drain` subcommands to we:scripts/lane-drain.mjs:
- **`planWatch(queuedState, manifestByNum)`** — pure planner (unit-tested): from the queued token + each item's manifest, partitions the queue into `ready` (no still-queued blockedBy), `deferred` (waits on an unlanded queued dep), `invalid` (manifest fails validation), and `unresolvable` (no manifest on the lane ref). Cross-item chains drain across passes (draining a head clears it → the dependent is ready next pass).
- **CLI loop** — reads the queue token (we:.claude/skills/batch-backlog-items/queued.json), reads each queued item's we:.lane-manifest.json off its WE lane ref (git fetch + git show the ref's manifest blob), drains each ready couple by **spawning `drain-one`** (never re-implements the land), cascades passes until nothing lands, then **regenerates the WE derived-artifact set once** (`gen:inventory` + `gen:reference-index` — the Phase 4c relocation). `drain` = one cascade pass then exit; `watch` = also polls `--interval`s for new producer enqueues (`--max-idle=N` bounds it; a human Ctrl-Cs otherwise).
- WE-root sanity guard mirrors `drain-one`; exits 2 if any couple failed to land (left queued for a re-drain / the #2175 reconcile).

Tests: we:scripts/__tests__/lane-drain.test.mjs +10 (planWatch ready/deferred/cascade/invalid/unresolvable/empty + source-guards).

**Pre-PR independent review (#2170)** — all findings accepted+fixed pre-PR (none dismissed): (HIGH) progress was gated on `drain-one`'s `landed` flag, so a land-but-unqueue-fail re-planned as ready forever → **hot loop**; fixed with an `attempted` guard (never re-drain a couple in one run) + a `landedButQueued` surface. (MED) stuck-queue-exits-0 → exit status now reflects whether the queue actually drained (`fullyDrained`, read from the post-run queue). (LOW) tmp-dir cleanup + bare-`--interval`/`--max-idle` coercion require an explicit `=N`.
