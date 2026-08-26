---
kind: story
size: 3
status: open
scope: ["we:.github/workflows/deploy.yml"]
dateOpened: "2026-08-26"
tags: []
---

# Stamp the deployed SHA into the Worker and define the rollback path

Nothing on the deployed Worker says which commit it is, so "what is live?" is unanswerable and rollback has no target. Expose the deployed sha (a /version route or a response header) and settle the rollback mechanism — redeploy-the-previous-green-sha from git (one mechanism, git-driven) vs Cloudflare native version rollback. Prerequisite for any recovery story.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
