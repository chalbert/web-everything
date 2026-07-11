---
kind: story
size: 5
status: open
blockedBy: ["2413"]
dateOpened: "2026-07-11"
tags: [lane-pool, guard, workflow, orchestrator]
crossRef: { url: /backlog/2413/, label: "#2413 — the ratified ruling (Fork 1 (a) + Fork 2 (b))" }
---

# Workflow-lane ownership: in-lane acquire + slug-asserted guard denial (implements #2413 ruling)

Implement the #2413 ruling: parallel /workflow lane prompts replace the manual destructive step-1 prep with LANE_SESSION=<batchSlug>-<laneKey> lane-pool acquire --lane=N (short TTL ~60-90min, explicit slug-carrying release at close-out, acquire per affected impl repo, invoked from the primary); the workflow acquire sets a dedicated workflowLane lease field; the destructive-git-op guard, for a live marked lease, requires the command string to assert the lease's own slug and denies on mismatch or absence (fail-closed, precedence over the degraded no-id path, deny message teaches the re-assert idiom). Unmarked leases keep today's semantics.

## Scope (from the #2413 ruling — Fork 1 (a) + Fork 2 (b), with all skeptic riders)

1. **Template** (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js): step-1 prep becomes

   ```bash
   # run from the primary (or explicit --repo=), once per affected repo (WE + each impl repo)
   LANE_SESSION=<batchSlug>-<laneKey> node scripts/lane-pool.mjs acquire \
     --lane=<idx> --purpose=workflow-lane --ttl-minutes=<~60-90> --json
   ```

   and the close-out gains a `release --lane=<idx>` step carrying the same inline slug.
   Template-authored destructive ops (if any remain) carry the slug assertion inline per op.
2. **lane-pool / lease** (we:scripts/lane-pool.mjs, we:scripts/lib/lane-lease.mjs): dedicated
   `workflowLane: true` lease field (contract field, not `purpose` free text), set by the workflow-lane
   acquire. No new verb.
3. **Guard** (we:scripts/guard-bash.mjs): for a destructive git op whose cwd is a lane holding a **live
   marked** lease, require the command string to assert the lease's own slug (parse like
   `LANE_CLOBBER_OK=1`); deny on mismatch **or absence** (fail-closed). The marked check runs before and
   independent of the `ownerSession` compare (fail-closed supersedes the no-id fail-open for marked
   leases only). Deny message names the expected re-assert idiom. `LANE_CLOBBER_OK=1` stays the escape.

## Acceptance (inherited from #2413)

- A destructive git op in a **sibling** parallel lane's clone is **denied** (slug mismatch or absence).
- The owning lane's own template-authored ops **pass**; the modulo-wrap double-coupling hard-fails the
  second acquire into a per-item carry instead of a mutual clobber.
- Serial topology and degraded no-id fail-open are **unchanged for unmarked leases** (all of today's).
