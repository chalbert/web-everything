---
kind: story
size: 3
status: open
blockedBy: []
dateOpened: "2026-07-01"
tags: [workflow, orchestrator, batch-parallel, closeout]
---

# Parallel orchestrator: reopen carried/unlanded items at closeout (they land `active` but unclaimed)

The `/workflow` clone orchestrator (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`) flips **every** item to `status: active` at central pre-claim, but only the items whose lane **lands** get flipped to `resolved`. An item that **fails to integrate** — lane red pre-merge, or a cross-repo-partial where an impl repo's merge fails so the WE resolve is skipped (the impl-first/WE-last atomicity guarantee) — is reported `carried` in the ledger but left `status: active` on `main` with **no claim** (`we:.claude/skills/batch-backlog-items/claims.json` doesn't hold it). That is a false-ownership signal: a `readiness --select` pack excludes it as "active" (owned) and it silently disappears from the pool, when in fact nobody is working it. First observed in `batch-2026-07-01-1965-2052` (the #1153 live run): #1974 (outgrew), #2012 (lane red), #2040 (plateau-app merge failed) all landed `active`-unclaimed and had to be reopened by hand at closeout.

**Fix:** in the integrator's closeout, reconcile each `carried` ledger entry back to `status: open` (drop `dateStarted`, or keep it as an attempt record), so unlanded items re-enter the next pack honestly. Distinct from the concurrent-id / merge self-healing work (that heals *colliding new items* at merge; this is *status reconciliation* for items that never merged at all). Surfaced by the first multi-lane run (memory note: parallel-orchestrator-first-real-multilane-run) / #1153; sibling to the orchestrator story #1147 and pre-lock slice #1945.

## Boundaries
- Only reopen items **this run** carried (in the returned ledger); never touch an item another session owns.
- A cross-repo-partial whose impl DID land in some repos (recorded in `partialCrossRepo`) is a re-attempt case — reopen the WE item but preserve the durable `lane/*` refs (don't delete them), so the next run resumes rather than redoes.
