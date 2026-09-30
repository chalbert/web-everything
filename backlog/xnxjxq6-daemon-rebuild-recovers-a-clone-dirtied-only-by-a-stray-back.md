---
kind: story
size: 2
tier: pinned
status: open
scope: ["we:scripts/lib/daemon-rebuild.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Daemon rebuild recovers a clone dirtied only by a stray backlog claim stamp

2026-09-29: the build daemon clone was dirtied by a stray backlog frontmatter edit (status: open→active + dateStarted on backlog/3809-*.md, written by a misdirected worker run). we:scripts/lib/daemon-rebuild.mjs refuses a dirty clone unless every dirty path is a known DAEMON_STATE_FILES entry, so every overlay and rebuild stopped until a human restored the file (the guard correctly blocks agents from writing to the clone). MVP: treat a dirty path under backlog/ whose diff is ONLY claim-stamp frontmatter keys (status, dateStarted, claimedBy-style fields) as recoverable: log it loudly (alert + the diff), restore the tracked copy, and continue; anything else stays a hard refuse. Test: claim-stamp-only diff → restored + alert; any body/other-key change → refused. Proof: replay the 2026-09-29 diff.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
