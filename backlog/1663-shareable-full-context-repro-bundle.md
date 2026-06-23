---
kind: epic
parent: "142"
status: open
dateOpened: "2026-06-23"
tags: []
---

# Shareable full-context repro bundle

Build the shareable full-context repro bundle — the dev-browser feature that exports a moment's full semantic context (declared state + action trace + declared rules + ownership) as one replayable link a teammate opens to land in the identical context. Graduated from decision #1631 (verdict: go). Sliced across the constellation per the layering rule: the bundle CONTRACT lives in WE (the shape of data), the viewer/replay UI in FUI, and the export+replay TOOL in plateau-app. The moat (per #142): a WE app is self-describing, so the bundle is semantic, portable and self-routing — not an opaque pixel/JS recording like Jam or Replay.io.
