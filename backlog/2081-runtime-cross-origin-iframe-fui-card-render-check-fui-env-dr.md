---
kind: story
size: 5
status: parked
dateOpened: "2026-07-02"
parkedReason: platform-gated
tags: []
---

# Runtime cross-origin iframe .fui-card render check (FUI env-driven ports)

Extend the #2000 render-check harness (we:scripts/dev/render-check.mjs) to the RUNTIME cross-origin path: a .fui-card rendered INSIDE a live FUI demo iframe (the #1895-proper case), not only WE's own home-grid tiles. Requires FUI to expose env-driven dev-server ports (its 6002/6080 are hardcoded, unlike WE's #1997 per-lane `WE_*_PORT`) so the harness can boot a WE+FUI pair on collision-free lane ports and assert the iframe frame from the CLI. Parked (`platform-gated`) on that unfiled FUI port work; unpark once it's filed + landed. #2000 delivered the build-time-coupled home-tile fixture (the leak class that shipped); this is the deferred runtime-iframe extension.
