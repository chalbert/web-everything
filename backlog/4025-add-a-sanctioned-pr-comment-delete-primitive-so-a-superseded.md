---
bornAs: x03o6zh
kind: task
status: open
scope: ["we:scripts/lib/review-label-provider.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Add a sanctioned PR-comment-delete primitive so a superseded stand-down marker can be removed, not just commented past

we:scripts/conveyor/parked-pr-conflict-watch.mjs (#3557 Fork 2) supersedes its own stale stand-down marker by posting a NEW comment explaining it, because no reviewer-label provider primitive exists to delete a GitHub PR comment (gh api -X DELETE issues/comments/{id}). Add one to we:scripts/lib/review-label-provider.mjs (or a sibling), tested the same way ensureLabel/setLabels/postComment are, then have the watch delete the superseded marker instead of leaving it to accumulate alongside the supersede comment. Follow-up from 4026.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
