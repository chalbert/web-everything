---
name: feedback_misflagged_batchable_fix_real_state
description: "a non-batchable item the selector tagged batchable must be fixed in the data (size/blocker/type/status), never just skipped at pre-flight"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 39313b36-02a2-48af-aafb-c4df85618e20
---

When pre-flight finds an item the `--select` loader tagged **batchable** is actually **not** workable, do NOT just skip it and note the reason in the ledger — **fix the real relationship in the data** so batchability is *derived from real state*, not re-judged every run. The loader only sees tier + `blockedBy`-all-resolved + `size`; a reason living only in the body (a buried fork, a stale-satisfied edge, an "external infra" deliverable, an author "not batchable as one" note) means the loader is right given the data and the **data is wrong/incomplete**. Skipping leaks: the next run surfaces the identical pool and the next agent re-rejects.

**Map the reason to the real edit** (the skill's "remediate the flag in place"):
- buried fork / open question → `type: decision` (moves to Tier B) **or** file a `decision` item and `blockedBy` it
- missing dependency stated only in prose → add the `blockedBy` edge (file the prereq item if it doesn't exist)
- author says "not batchable as one / re-slice" or it genuinely outgrew → bump `size` to ≥13 (drops from the pool; needs `/slice`)
- blocked by-design with no node to wait on (resolved blocker that declined to decide; external/human-only infra) → `status: parked` with a dated reason
- a satisfied `blockedBy` that went falsely-green → re-block on the *real* prerequisite, don't leave it open

**Find the *right* real state — read the WHOLE body, latest section first (#1355/#1531, 2026-06-23):** backlog bodies are append-only chronologies and the **last dated section wins**. Acting on a mid-body phrase, I re-blocked two *ready* items to a superseded blocker — their latest section had already repointed to a slice that was now resolved, so they were **unblocked**, not non-batchable; the `blocked-in-fact` the gate flagged was **stale historical prose**. Also: the gate greps the literal token, so even "no longer blocked-in-fact" trips it — reword it out entirely, don't reuse it. And a resolved blocker (or an all-children-resolved epic) means *unblocked*, not re-block. If the item is `active`/concurrent-owned, **leave it to its session** (it holds the live blocker graph — here a concurrent session filed the real new blocker #1660) — surface, don't edit.

**Why:** the batchable filter must mean "really workable now"; an unfixed flag over-reports agent-readiness and wastes every future pre-flight. **How to apply:** during a batch, remediate on discovery (pure-agent edits only — never quietly make a design call to force batchability; escalate an irreducible fork as a `decision` item); at close-out, sweep any you only ledgered. Then re-run `check:standards` (errors on cyclic/unresolvable edges) + `--select` to confirm the pool collapsed. Worked example 2026-06-16: a 14-item pool collapsed to 4 by filing #809 (cluster decision) + edges, #810 (emitter prereq) + edge, #697→size13, #774/#775→decision, #297/#184→parked. Builds on [[feedback_batch_working_practices]] and [[feedback_remediate_before_escalate]]; the no-`dirty`-skip rule still holds ([[feedback_claim_ignores_git_state]] — uncommitted tree is never the reason).
