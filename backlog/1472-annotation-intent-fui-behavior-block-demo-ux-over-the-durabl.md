---
kind: epic
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
relatedReport: reports/2026-06-22-backlog-split-analysis.md
tags: []
---

# annotation intent + FUI behavior block + demo — UX over the durable-range-anchor contract

Umbrella for realizing the annotation intent (UX over the resolved #1471 durable-range-anchor contract); sliced into the WE intent JSON (#A), the FUI behavior block (#B), and the highlight-and-comment demo (#C) — see [the split analysis](reports/2026-06-22-backlog-split-analysis.md), Run 7. Realizing build ratified by #1408 (Fork 2 split, UX half): select content then attach a motivation payload (highlighting|commenting|tagging|suggestion) with an overlay disposition; composes #1471 + selection / rich-text (in-model mark when editable) / anchor+popover / highlight-api. Owns no anchor machinery. Orphaned-annotation is a first-class outcome; comment-thread product UI stays app-level.

## Pre-flight (batch-2026-06-22-1510-1483) — full greenfield /new-standard build → re-size 8 → 13, route to /new-standard

Claimed + ground. The blocker #1471 (durable-range-anchor) is **resolved** and its `we:blocks/range-anchor/contract.ts`
**exists**, so the anchor contract this composes is importable. But realizing the annotation standard is a
**full greenfield, multi-artifact /new-standard build** (sibling of #1460), nothing built yet:

- **Net-new intent** `we:src/_data/intents/annotation.json` (UX-only per #1408 Fork 2: select content →
  attach a motivation payload `highlighting|commenting|tagging|suggestion` + overlay disposition; **composes**
  the #1471 anchor contract + selection / rich-text / anchor+popover / highlight-api; owns no anchor
  machinery). This is the clean foundational artifact (it imports an existing contract — no net-new
  contract module needed, unlike #1460).
- **Net-new FUI behavior block** realizing it — cross-repo, composes the #1471 contract.
- **Demo** (highlight + comment over read-only HTML) — live-verify on the FUI dev server.

The card says **"File via /new-standard"** (prior-art survey + slice decomposition). **Recommend routing
there**, decomposing into: (1) foundational **`we:src/_data/intents/annotation.json`** (WE, batchable — composes existing
contracts), (2) **FUI annotation behavior block** (← 1), (3) **demo** (← 2). Re-sized **8 → 13** (drops from
the batch pool). Carry-forward reason: **outgrew / not-batchable-as-one** (full /new-standard build, behavior
block + live demo are a focused cross-repo session). No new design fork (UX-only split ruled by #1408).
Released `open`.
