---
bornAs: xzgt6zd
kind: story
size: 2
status: open
dateOpened: "2026-08-08"
relatedTo: ["2606", "1855", "3010"]
tags: [progress-board, metrics, throughput, governance]
---

# Put the weekly product-vs-machinery output ratio on the progress board

Add one standing number to the progress board: lines added this week to product code versus lines added to
delivery machinery and backlog bookkeeping, with the last four weeks beside it. The 2026-08-08 delivery
review measured the slide at product +1,699 → +705 → +480 → +147 lines/week while machinery grew to
+38,000/week — a month-long trend nothing on the board surfaced. This metric makes the drift visible the
week it starts, so it costs one glance instead of an audit.

## The measurement

Derivable from git alone, so the board generator can compute it mechanically:

- **Product** = lines added under `we:src/`, `we:blocks/`, `we:demos/`, `we:tests/`.
- **Machinery + bookkeeping** = lines added under `we:scripts/`, `we:tools/`, `we:.claude/`,
  `we:docs/agent/`, plus `we:backlog/`.
- A small "other" remainder is excluded from both.

Render the current week's two numbers and a four-week mini-trend on the board (the generator the
progress-board item x9t5i5a builds, in flight as PR #1101). No new data store — `git log --numstat` over
the merged history is the source.

## Why on the board and not a report

The board is the one surface the operator already reads daily. #2606 (the throughput program) tracks
latency; this is the missing *output-mix* axis. It is also the enforcement instrument for the process-work
freeze / product-quota decision (#3010): a quota nobody can see is a quota nobody keeps.
