---
name: feedback_batch_never_self_judge_stop
description: "In a batch, never stop on your own judgement and never ask for a context reading mid-run — the points budget is the sole driver"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f73c2aff-71f1-4d5b-9ab0-f0bfaf3b4d53
---

In a `/batch`, the **points budget is the only soft driver of when to stop**. Never stop on your own
judgement, and **never interrupt the batch to ask the user for a context-meter reading** to decide whether
to continue. The only stops are the four hard conditions: gate red, points budget reached, no eligible
item left, a design fork surfaced.

**Why:** I cannot read my own context meter, so any "I've read a lot / this is long / I'm at a subsystem
boundary" stop is a guess that reliably mis-fires (a batch that *feels* full has measured ~22% used). The
budget *already is* the context limit — it's calibrated from a real context-% reading at close-out
(`capacityPoints × targetFraction`). Asking "should I keep going?" mid-run re-introduces the
judgement-stop through the back door and is the exact anti-pattern. The user authorizes the whole budget
with one "go" and expects it honoured.

**How to apply:** Absent one of the four hard stops, the next action is *always* to claim the next eligible
item — including through repo/subsystem boundaries (those are plan-time *ordering* hints, never stops).
The context-% question belongs at **close-out only**, for calibration (`backlog.mjs calibrate
--context-pct=`), never as a continue/stop gate. Codified in
[[project_backlog_workflow_clis]] territory — docs/agent/backlog-workflow.md → "The stop rule" and the
batch skill SKILL.md (both rewritten 2026-06-13 to remove the context-seam stop). Relates to
[[feedback_context_meter_ask_dont_estimate]] (ask, never estimate — but at close-out, not as a stop gate)
and [[feedback_batch_working_practices]].

**2026-06-13 — the under-run I shipped, and the two fixes (so it can't recur).** I stopped a batch at
35/58 pts (~32% context) by *judgment-deferring* claimable items — calling a `story·8` "too big" and a
WE-local bug "needs a focused session". Both are exactly the gut stops this memory forbids. Two mechanism
fixes now make it structural, not discipline-dependent:
1. **Drop-reason classifier** — a *declined* item is **not** a stop. Every Tier-A item the seam re-pack
   surfaces that you don't claim must carry one **hard** reason: `dirty` (the `claim` tool refused it),
   `blocked-in-fact` (a needed artifact *verified* absent), `not-batchable` (`decision`/`≥13`/`epic`),
   `out-of-locus`, or `outgrew` (claimed-AND-began, then sprawled — never a pre-claim "looks big" guess).
   No hard tag ⇒ **claim it**. "Outgrew" fires only mid-work; a `story·8` that is ~8 pts hasn't outgrown.
2. **Repo-locus** — an item's `locus` (its gate home: `webeverything` default / `frontierui` /
   `plateau-app` / `exercise-app`) is loader-derived (explicit `locus:` › #314-descendant › precise tag);
   `--select` packs only the batch's own locus, shunting the rest to "Other locus". So cross-repo items
   are out of the pool *by construction* — never a judgment defer. Resolving a plateau-app/FUI item on
   WE's green `check:standards` is dishonest (that gate never ran it); the locus filter prevents it.
   Don't conflate "cross-repo / needs care / load-bearing" with a hard stop. See docs/agent/backlog-workflow.md
   → "The drop-reason classifier" + "Repo-locus".
