---
bornAs: xlqampw
kind: story
size: 3
parent: "3999"
status: open
scope: ["we:scripts/lib/daemon-self-sync.mjs", "we:scripts/lib/__tests__/daemon-self-sync.test.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Daemon POC self-sync mode for we:scripts/lib/daemon-self-sync.mjs

Epic #3383's daemon POC (backlog/3999-*.md, we:docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode) needs a daemon clone that can run tracking lane/daemon-poc instead of main. Add an opt-in mode to we:scripts/lib/daemon-self-sync.mjs: when DAEMON_SELF_SYNC_BRANCH=<poc-branch> is set, the clone runs on that local branch (decideSelfSync's onBase check widens to it) and each tick fetches origin/main AND origin/<poc>, merges both into HEAD by merge commit (never rebase, never push), aborts and skips on conflict, and the wrapper restarts the daemon when anything new arrived -- mirroring the existing merge-not-rebase / restart-on-new-code contract. Default (unset) behavior stays byte-identical. Unit tests in we:scripts/lib/__tests__/daemon-self-sync.test.mjs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
