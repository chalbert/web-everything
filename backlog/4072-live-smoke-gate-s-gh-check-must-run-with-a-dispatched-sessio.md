---
bornAs: xhd7flk
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/lib/daemon-live-smoke.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Live smoke gate's gh check must run with a dispatched session's environment

2026-09-24: the live smoke gate (we:scripts/lib/daemon-live-smoke.mjs, PR #2601) passed its gh read while dispatched bots got 401 Bad credentials, because the gate ran gh with the daemon's own environment, not the shimmed one a dispatched session gets. Run the gate's gh probe through the same shim settings env (we:scripts/lib/gh-app-shim.mjs buildGhShimSettingsEnv) a dispatched session receives, and prove it fails on a broken token.

## Done when

1. **Executable** — a test proves the gate's `gh` probe runs with the dispatched-session shim env, and that
   a deliberately broken App token makes the gate fail (today it passes).
