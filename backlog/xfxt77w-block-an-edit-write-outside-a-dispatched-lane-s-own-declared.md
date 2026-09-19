---
kind: story
size: 5
parent: "xyp1wsl"
status: open
scope: ["we:scripts/guard-lane.mjs", "we:scripts/lib/lane-lease.mjs", "we:scripts/readiness/scope-lease.mjs", "we:scripts/conveyor/lease-reaper.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Block an Edit/Write outside a dispatched lane's own declared scope in guard-lane

we:scripts/guard-lane.mjs already reads a lane's live lease (we:scripts/lib/lane-lease.mjs, via laneRootFromCwd + readLaneLease imported from we:scripts/guard-bash.mjs) for its #2997 occupancy-check arm. we:scripts/lane-pool.mjs's acquire --scope=<repo:path,...> already persists that same declaration into the lease as predictedScope (we:scripts/lane-pool.mjs ~line 884-1030) whenever the dispatched agent runs the acquire line we:scripts/operations/dispatch-lane.mjs's fillBrief hands it. Add a new we:scripts/guard-lane.mjs arm: when the edit target's lane holds a live lease with a non-empty predictedScope, deny the Edit/Write unless the target's realpath falls inside that scope. Reuse the EXISTING granularity-aware path-matching predicate from we:scripts/readiness/scope-lease.mjs (breachOf / isSubtreeEntry / normScope, WE #2560/#2679) rather than re-deriving path matching — that module already answers exactly this question for the reactive post-hoc collector; this arm asks it BEFORE the write instead of after. PREFER deriving the item's scope from ITS OWN backlog frontmatter as ground truth (decode the item number from the lease's session slug via we:scripts/conveyor/lease-reaper.mjs's itemNumFromSession, then read that item's scope: field directly) rather than trusting only the agent-typed --scope= flag verbatim — the flag is prose-driven (an agent could omit or mistype it) while the item's own scope: frontmatter cannot silently drift. Fall back to the lease's predictedScope when no item number can be decoded. A lane with NO live lease, or a live lease with EMPTY predictedScope/no decodable item, stays fully unrestricted (mirrors the #2997 fail-open discipline we:scripts/guard-lane.mjs already documents) — this is deliberately an opt-in tightening, not a retroactive one. Escape hatch: reuse the SCOPE_BREADTH_GUARD_OFF-style env convention already used by we:scripts/guard-lane.mjs's LANE_GUARD_OFF=1, e.g. SCOPE_GUARD_OFF=1, per this repo's established per-guard override pattern.

## Done when

1. **Executable** — a unit test in `we:scripts/__tests__/guard-lane.test.mjs` (or a sibling test file)
   constructs a lane with a live lease carrying `predictedScope: ["we:scripts/foo.mjs"]` (and, separately,
   one carrying a decodable item number whose backlog file declares `scope: ["we:scripts/foo.mjs"]`) and
   asserts: an `Edit`/`Write` target realpath-ing to `we:scripts/foo.mjs` is ALLOWED; a target realpath-ing
   to `we:scripts/bar.mjs` is DENIED (exit 2, a message naming the declared scope and the extension-request
   path); `SCOPE_GUARD_OFF=1` bypasses the deny; a lane with no live lease, or a live lease with empty
   `predictedScope` and no decodable item, is UNAFFECTED (fully allowed, matching today's behavior) — passes
   after this item lands, fails (or does not exist) before it.
2. `check:standards` and `test:unit` stay green.
