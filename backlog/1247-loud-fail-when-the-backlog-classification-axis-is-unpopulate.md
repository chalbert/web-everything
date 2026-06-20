---
kind: story
size: 2
status: open
blockedBy: ["487"]
dateOpened: "2026-06-20"
tags: []
---

# Loud-fail when the backlog classification axis is unpopulated (don't render all-zero readiness silently)

Make the loader/validator ERROR when an open item's classification axis can't be resolved — rather than silently rendering an empty board. Caught live during #487's type+workItem→kind cutover: consumers (we:src/_data/backlog.js, we:scripts/readiness/engine.mjs) were switched to `item.kind` ahead of the data, so `kind` was undefined for every item and the `/backlog/` Prioritisation tab showed 0 batchable / 0 decision / 0 program — a silent collapse, not a loud break.

## The gate

- Assert every open item resolves to a valid `kind` (else error), not `undefined`.
- Add a counts-invariant: open>0 but `{batchable, tierB, sliceable}` all 0 is a hard error, not a quiet zero.

Mirrors the #466 Fork-2 "loud break" but for the *during*-migration window (consumers ahead of producers) — which #487's after-cutover leftover-field backstop does not cover. Lands in the post-#487 validator.
