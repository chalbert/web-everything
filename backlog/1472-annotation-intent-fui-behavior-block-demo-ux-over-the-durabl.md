---
kind: story
size: 13
status: open
blockedBy: ["1471"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
tags: []
---

# annotation intent + FUI behavior block + demo — UX over the durable-range-anchor contract

Realizing build ratified by #1408 (Fork 2 split, UX half). Author the annotation intent JSON (UX-only): select content then attach a motivation payload (highlighting|commenting|tagging|suggestion) with an overlay disposition; COMPOSES the #1471 durable-range-anchor contract + selection / rich-text (in-model mark when editable) / anchor+popover / highlight-api. Owns no anchor machinery. Plus the FUI behavior block realization and a demo (highlight + comment over read-only HTML). Blocked by #1471 (can't import the anchor we:contract.ts until it lands). File via /new-standard. Orphaned-annotation is a first-class outcome; comment-thread product UI stays app-level.

## Pre-flight (batch-2026-06-22-1510-1483) — full greenfield /new-standard build → re-size 8 → 13, route to /new-standard

Claimed + ground. The blocker #1471 (durable-range-anchor) is **resolved** and its `we:blocks/range-anchor/contract.ts`
**exists**, so the anchor contract this composes is importable. But realizing the annotation standard is a
**full greenfield, multi-artifact /new-standard build** (sibling of #1460), nothing built yet:

- **Net-new intent** `we:src/_data/intents/annotation.json` (UX-only per #1408 Fork 2: select content →
  attach a motivation payload `highlighting|commenting|tagging|suggestion` + overlay disposition; **composes**
  the #1471 anchor contract + selection / rich-text / anchor+popover / highlight-api; owns no anchor
  machinery). This is the clean foundational artifact (it imports an existing contract — no net-new
  contract.ts needed, unlike #1460).
- **Net-new FUI behavior block** realizing it — cross-repo, composes the #1471 contract.
- **Demo** (highlight + comment over read-only HTML) — live-verify on the FUI dev server.

The card says **"File via /new-standard"** (prior-art survey + slice decomposition). **Recommend routing
there**, decomposing into: (1) foundational **`annotation.json`** (WE, batchable — composes existing
contracts), (2) **FUI annotation behavior block** (← 1), (3) **demo** (← 2). Re-sized **8 → 13** (drops from
the batch pool). Carry-forward reason: **outgrew / not-batchable-as-one** (full /new-standard build, behavior
block + live demo are a focused cross-repo session). No new design fork (UX-only split ruled by #1408).
Released `open`.
