---
bornAs: xoeyi0b
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["4044", "4043"]
dateOpened: "2026-09-24"
tags: [daemon, review, trust-chain]
scope: ["we:scripts/operations/review-dispatch.mjs", "we:scripts/review-set-label.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:scripts/lib/"]
---

# Route overlay-overlapping PR reviews to a main-only checkout

Build the #4043 ruling: when the review daemon runs a live overlay, any PR whose changed files overlap an active overlay is reviewed from a dedicated main-only checkout, failing closed to review:human with an alert; review-set-label --to=accepted refuses from an overlapping checkout. Closes the #809 self-approval hole for overlays (drain-daemon-self-hosting-boundary clause 3 as amended).

## Done when

1. **Executable** — a vitest suite for the dispatch + label paths: a PR whose changed files overlap an active
   overlay dispatches with `cwd` = the `main`-only root, including after its commits are rebased/amended
   relative to the loaded overlay; with that root missing/stale it parks `review:human` and alerts;
   `we:scripts/review-set-label.mjs --to=accepted` from an overlapping checkout refuses. Proven by
   `mutation-check` (drop the overlap test → suite fails).
2. The dedicated `main`-only review clone is provisioned and self-syncs; its freshness shows in the heartbeat (#4051).
3. Live proof: load a real overlay into `wev-review-daemon`, open its PR, and show the review session ran from
   the `main`-only checkout (before/after evidence).
