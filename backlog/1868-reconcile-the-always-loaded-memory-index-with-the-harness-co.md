---
kind: decision
parent: "1855"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Reconcile the always-loaded memory index with the harness compact target

The Claude Code harness asks for the memory index compacted under ~17.1KB (24.4KB hard read-limit), but this project's we:scripts/check-memory.mjs gate allows 22KB and the index (we:MEMORY.md) sits at ~21.4KB across ~140 one-line entries — all verified load-bearing, so mechanical trimming can't close the ~4KB gap. Decide the structural fix: evict lowest-recall-value entries out of always-loaded recall into a lazily-searched tier, shard the single index, or re-calibrate the gate to track the harness limit. It matters because the index is always-loaded context every session pays for — the exact surface the model-usage watch (#1855) guards. Surfaced 2026-06-27 when the harness compaction hook fired repeatedly during the #1864 prune.
