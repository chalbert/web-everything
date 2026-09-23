---
bornAs: xyi4m1w
kind: story
size: 3
parent: "3383"
status: resolved
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# The drain never resolves an item that was filed AND delivered in the same lane PR — it JIT-numbers it and leaves it active forever

When a lane files a --session (born-active) item and delivers it in the same PR, the drain assigns its NNN at land but never flips status to resolved. #3459, #3492, #3638 all shipped this way (PRs #1852, #1914, #2137) and sat active for weeks, showing as abandoned claims on /wip. The stranded sweep finds 106 such candidates. Fix at land: when the landing lane ref names the item hash/NNN and the item is still born-active in that PR, resolve it.

## Done when

1. **Executable** — a drain unit test: landing a lane PR that adds a born-active `x…` item AND carries its lane ref (`lane/<hash>-…`) leaves the numbered item `status: resolved` with `dateResolved`. Fails today (stays `active`), passes after.
2. **Observed** — `node we:scripts/backlog-stranded-sweep.mjs --limit=2000` no longer grows from new lands after this ships.
