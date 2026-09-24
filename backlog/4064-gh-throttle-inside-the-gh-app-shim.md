---
bornAs: xbhoirp
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/gh-app-shim.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# gh throttle inside the gh App shim

2026-09-24: many dispatched sessions calling gh at once burned the App's rate limit. Add a host-wide throttle (token bucket over a shared lock) inside the shim script rendered by we:scripts/lib/gh-app-shim.mjs, so every dispatched gh call is paced in one place. Sequenced after PR #2600 (4039, the shim's 401 fallback), which is merged.

## Done when

1. **Executable** — a test proves N concurrent shimmed `gh` calls are paced to the configured rate across
   processes (shared lock), and the shim still falls back on a rejected token as PR #2600 made it.
2. **Live proof** — App rate-limit remaining stays above the floor during a real dispatch burst.
