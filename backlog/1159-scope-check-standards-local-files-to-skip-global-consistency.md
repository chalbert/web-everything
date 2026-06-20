---
type: idea
workItem: story
size: 3
parent: "1143"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Scope check:standards --local --files to skip global-consistency rules in isolation

The parallel `/workflow` orchestrator gates each concurrent item in its own worktree via the #1144 `--local --files` mode, but that mode still runs whole-repo **global-consistency** rules (registry/referenceIndex coherence, block contract↔impl drift) a worktree branched from base **cannot** satisfy in isolation. First real multi-lane run (#1153): **4 of 7 concurrent items false-red'd in-worktree** (#1071/#1139/#1058/#1137), then gated green on serial replay — eating the parallel speed-win. Fix: restrict `--local --files` to **file-local** rules; defer global checks to the integrator's full per-merge gate. First diagnose the real per-item red reasons (inferred, not captured this run). Owner: epic #1143; built in resolved #1144; symptom in #1153.
