---
type: issue
workItem: story
size: 3
status: open
dateOpened: "2026-06-18"
tags: []
---

# check:health --scope reuse + batch gate step adopts --scope

Follow-on to #952 (which built `check:standards --scope=<session>` + the claim-time git baseline, ratified
#949). Two remaining halves: **(1)** give `check:health` the same `--scope` mode — trivial since its
findings already carry the owning item `id` (`we:scripts/audit-backlog-health.mjs`), so scope = the
session's claimed ids from `we:.claude/skills/batch-backlog-items/claims.json` (the #952 claim baseline now
also stamps owning ids per session); reuse the existing G1 INFO-vs-FAIL partition. **(2)** Make the batch
gate step **adopt** `--scope=<batch-slug>` so the manual scoped-stop triage (grep errors + `git status`,
memory `gate-red-stop-scoped-to-own-work`) becomes deterministic — update `we:docs/agent/backlog-workflow.md`
+ the `batch-backlog-items` skill's gate seam. Not blocking (no resolved-#952 edge needed; the build
shipped). Sibling of #953 (the Fork 2-C file-claim precision upgrade).
