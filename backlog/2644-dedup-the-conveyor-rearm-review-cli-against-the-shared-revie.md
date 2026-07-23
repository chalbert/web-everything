---
bornAs: x6udsap
kind: story
size: 2
parent: "2612"
status: open
scope: ["we:scripts/conveyor/rearm-review.mjs", "we:scripts/review-set-label.mjs"]
dateOpened: "2026-07-23"
tags: []
---

# Dedup the conveyor rearm-review CLI against the shared review-set-label helper (reuse decideSetLabel)

Surfaced by the jury review of #2630 (PR #702, simplicity lens). `we:scripts/conveyor/rearm-review.mjs` (204 lines) is a near-verbatim clone of `we:scripts/review-set-label.mjs`: `presentRemoveLabels` and `ghErr` are copied byte-for-byte (the former is already *exported* from there), and the whole `gh pr view labels → decide → edit add/remove → --body-file comment → re-read` CLI harness is duplicated. Only the pure `decideRearm` swap (`review:changes` → `review:pending`) is genuinely new. Fold it in as a third verdict target on `decideSetLabel` so the shared CLI + helpers are reused, leaving only the real deltas (the comment body, the default `--actor`, the optional-`--repo` fallback). Removes a duplicated label-swap I/O boundary that would otherwise drift.
