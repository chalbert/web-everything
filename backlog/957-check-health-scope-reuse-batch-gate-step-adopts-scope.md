---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
tags: []
---

# check:health --scope reuse + batch gate step adopts --scope

Follow-on to #952 (`check:standards --scope=<session>` + claim-time git baseline, ratified #949). Two
halves: **(1)** give `check:health` the same `--scope` mode — its findings already carry the owning item
`id`, so scope = the session's claimed ids from the #952 claims registry; reuse the G1 INFO-vs-FAIL
partition. **(2)** Make the batch gate step **adopt** `--scope=<batch-slug>` so the manual scoped-stop
triage (grep errors + `git status`, memory `gate-red-stop-scoped-to-own-work`) becomes deterministic —
update `we:docs/agent/backlog-workflow.md` + the `batch-backlog-items` skill gate seam. Sibling of #953
(Fork 2-C file-claim precision upgrade).

## Progress (batch-2026-06-18) — resolved

**(1)** `check:health --scope=<session>` lands in `we:scripts/audit-backlog-health.mjs`: id-axis
attribution mirroring `check:standards --scope`. Added `claimedIdsFor` + `partitionById` to the shared
`we:scripts/readiness/claimScope.mjs` (pure, fixture-tested), parse the session's claimed ids from
`we:.claude/skills/batch-backlog-items/claims.json`, normalize claim slugs (`964-…`) to the numeric
finding id, and demote every flag owned by another session to a non-failing note count. D3 (project-keyed,
no item id) stays in view fail-safe. Default no-flag run unchanged (whole-backlog). Also fixed a
**pre-existing D1 false-positive class** the scope surfaced: the dead-file-ref resolver now strips the
`we:`/`fui:`/`plateau-app:` repo-locus prefix (#883) before resolving — cleared 43 false dead-refs
backlog-wide (D1 60→17).

**(2)** The batch gate step now adopts `--scope=<batch-slug>` on both WE gates: documented in
`we:docs/agent/backlog-workflow.md` (§2 check:health + the stop-rule gate-red triage) and the
`batch-backlog-items` SKILL gate seam + stop-rule line. 14 claimScope tests green; full `check:standards`
green.
