---
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/review-set-label.mjs", "we:scripts/lib/approval-prevention-notice.mjs", "we:scripts/operations/review-loop-cli.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Approval-time prevention filing works from any cwd and lands its card

`we:scripts/review-set-label.mjs`'s approval-time filing runs `file-item` in the process cwd; from the primary checkout it is refused (live: #2939, 2026-09-29), and even from a lane it only writes the card to the working tree — nothing commits it or opens a PR, so the owed card is lost unless someone lands it by hand.

This is not just a #2939 near-miss — it has already lost cards at scale. The review daemon clone `~/workspace/wev-review-daemon` holds 74 untracked `backlog/x*-file-the-prevention-guard-s-owed-by-*.md` cards (git status, 2026-09-29 1:25 PM ET). The daemon's own approval-time/review-loop prevention filings write the card into its clone's working tree and nothing ever lands them; daemon-rebuild logs them as "untracked-kept". So owed prevention cards have been silently lost at scale across BOTH filing callers, not just the one this item started from.

Fix: the filing step acquires its own lane, files, commits, verifies, opens the PR, releases the lane. This must cover every filing caller — `we:scripts/review-set-label.mjs`'s approval-time filing AND the review daemon's review-loop filing (e.g. `we:scripts/operations/review-loop-cli.mjs`) — and the MVP should also land (or dedupe via the idempotency key, then land) the 74 stranded cards through this same product path, never by hand-copying files out of the daemon clone.

Soak break: run the ceremony from the primary cwd on a PR owing prevention and show the card's PR opens.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
