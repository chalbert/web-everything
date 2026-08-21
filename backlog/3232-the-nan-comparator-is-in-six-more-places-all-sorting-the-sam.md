---
bornAs: xayqtgr
kind: story
size: 3
parent: "2288"
status: open
dateOpened: "2026-08-21"
tags: []
---

# The NaN comparator is in six more places, all sorting the same id space

PR #1504 fixed the node and edge sorts in we:src/_data/backlogGraph.js. Its correctness juror found the identical Number(a)-Number(b) pattern still live in we:src/_data/backlog.js at 805 and 895, we:src/assets/js/backlog-graph.js at 141, 147 and 157, and we:src/assets/js/backlog-active.js at 277 — all sorting the same JIT id space where Number of a hash is NaN, so every one is an inconsistent comparator whose order Array.sort may permute between runs. Two of them are browser-side, so the page can render a different order than the build produced. Promote the primitive to a shared module those call sites import, and add a check:standards rule that flags Number used directly inside a sort comparator so a new call site cannot re-derive it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
