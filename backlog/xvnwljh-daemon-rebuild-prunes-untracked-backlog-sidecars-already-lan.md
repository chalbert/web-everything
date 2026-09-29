---
kind: story
size: 2
status: open
scope: ["we:scripts/lib/daemon-rebuild.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Daemon rebuild prunes untracked backlog sidecars already landed on main

Follow-up to the orphan prevention-card sweep (PR #2901/#2904, 2026-09-29): daemon clones (wev-review-daemon) accumulate untracked backlog/x*.md files written by the old approval-time filer; after they land, the clone's copies stay forever because the rebuild's dirty check ignores untracked files by design and no sanctioned cleanup exists. MVP in we:scripts/lib/daemon-rebuild.mjs: after fetching origin/main, remove an untracked backlog/x*.md only when origin/main has a card whose bornAs equals that hash id (provably landed); never touch anything else. Must: tests for landed/unlanded/non-card paths; live proof: the clone's 22 already-landed copies disappear on the next rebuild.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
