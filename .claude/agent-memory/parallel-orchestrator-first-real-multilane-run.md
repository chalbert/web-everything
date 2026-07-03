---
name: parallel-orchestrator-first-real-multilane-run
description: First real /workflow multi-lane batch landed green end-to-end — the
metadata: 
  node_type: memory
  type: project
  originSessionId: d88e7fec-12c3-4f98-8a4c-6a8d7611f817
---

2026-07-01, batch-2026-07-01-1965-2052 (`/workflow`, 18 items / 66 pts): the FIRST real
multi-lane parallel run — the live validation #1153 was gating on. Outcome: **15 resolved /
57 pts landed, 3 carried**. 10 concurrent lanes + 8 serial, cross-repo across WE→frontierui→plateau-app,
**3 conflicts rebase-replayed correctly**, derived artifacts regen'd once, no probe storm, no stranded resolve.

What held / what to watch next time:
- **Cross-repo atomicity worked**: both cross-repo-partials (#2012 lane-red pre-merge, #2040
  plateau-app merge failed) left **no false `resolved`** — impl-first/WE-last ordering did its job.
  Merge-failed lane refs (`lane/batch-*-2040` in WE+plateau) are **preserved on origin** for re-attempt (durable).
- **Carried items land as `status: active` but unclaimed** — a false-ownership signal that hides them
  from the next pack. Had to **manually reopen** #1974/#2012/#2040 to `open` post-run. The orchestrator
  should do this itself; until it does, closeout must reset carried items. See [[closeout-never-infers-ownership-from-dirty-tree]].
- **`multiLaneFiles: we:src/css/style.css`** flagged (touched by #2016/#2055/#1895) — all serial-lane so
  applied one-at-a-time (no risky parallel merge), but the optimistic-floor detector flags it regardless; close-skill re-checks.
- **Health warns during the run were ALL recoverable** (`tool error (is_error)`): transient tool
  failures + hook denials + the designed merge-conflict→rebase path. Every one cleared within ≤1 tick.
  Rule of thumb: a flagged lane that is still actively editing/reading is not wedged — only escalate if it goes idle.
- Pre-flight caught #1992 (unencoded ordering dep on #2048) before launch → encoded `blockedBy: 2048`.
- #1974 "outgrew": #2028 ruled the light-DOM contract but `graduatedTo: none` — the `LightLeafElement`
  base class is NOT built, so the "mechanical size·3" migration needs that base built first. See [[host-is-the-node-default]].

Calibration correctly SKIPPED (parallel resolves in subagent contexts; orchestrator context-% is meaningless).
