---
bornAs: xq20q91
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/lib/daemon-self-sync.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
graduatedTo: none
tags: []
---

# self-sync git steps need a timeout so a hang can never freeze a daemon

selfSyncCheckout's git calls (we:scripts/lib/daemon-self-sync.mjs) ran spawnSync with no timeout, so a hung fetch/merge could freeze the whole daemon; added a per-command timeout (default 60s) + SIGKILL.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/daemon-self-sync.test.mjs` passes, including the new timeout-shaped-result and timeoutMs-passthrough cases that did not exist before this item landed.
