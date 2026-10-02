---
kind: story
size: 3
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/conveyor/health-responder-edge.mjs", "we:scripts/conveyor/__tests__/health-responder-edge.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: run the daemons from the edge with the open fixes for stuck PRs

Operator, 2026-10-02: "instead of being blocked by the PR chain, we get all the fixes in, see the stuck PR land, then only then do we open the PR from the fix". The daemon clones already support live overlays (we:scripts/daemon-overlay.mjs: a clone tracks main plus registered refs; every rebuild is smoke-gated and falls back to last-good). Action (allowlisted): when a stuck-PR episode has an open fix PR (its root-cause card), register that fix branch as an unpinned overlay on the daemon clones it changes, with the episode as reason; confirm the gated rebuild adopted it; then watch the stuck PR land as the proof the fix works on the live case; then the fix PR itself proceeds through normal review and merge, and the overlay is removed once it is merged or closed. Never overlays a branch whose required checks are red or whose review found a security block; at most N overlays per clone; every add and remove is a decision-log record and a comment on the fix PR. First live use: 2026-10-02, the orchestrator overlaid #3507 (review rulings carry) and #3432 (cancelled-check classifier) onto wev-review-daemon.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
