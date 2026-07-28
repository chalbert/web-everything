---
bornAs: xaq4sub
kind: story
size: 5
parent: "2551"
status: open
scope: ["plateau:src/backlog-view/", "plateau:vite.config.mts", "we:scripts/lane-pool.mjs", "we:scripts/readiness/conveyor-state.mjs"]
dateOpened: "2026-07-28"
tags: []
---

# Post-hoc review: forensics and take-over for stalled or failed lanes

For stalled/stopped/failed/orphaned lanes, show a post-mortem (last state, diff-so-far, why it stalled) so recover/retry/reassign/discard/take-over is an informed choice, and let the operator assume a build (holding the lane) and hand it back. The state classification already exists (card-state-read-model UC-A5/E1/E3); this adds a forensics detail panel + read endpoint, sourcing why-it-stalled from we:scripts/readiness/conveyor-state.mjs and diff-so-far/lease-hold from we:scripts/lane-pool.mjs. Take-over/release rides this review surface.
