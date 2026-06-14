---
type: issue
workItem: story
size: 3
parent: "507"
status: resolved
blockedBy: ["547"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
tags: []
---

# Adapter dev-time regression corpus (no AI automation)

Slice 4 of #507 (epic). The regression corpus + snapshot gate the deterministic generation-adapter (#547) is improved against — the substrate any improver (human now, AI later) edits rules/templates against and re-runs to catch generator-output drift. Explicitly EXCLUDES the full-AI improvement cycle (out of scope per #463). Parallels #548/#549 — needs only the engine. Home: generation/corpus/. Per #463 fork a.
