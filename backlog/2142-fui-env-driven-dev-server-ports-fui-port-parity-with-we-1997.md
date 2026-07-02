---
kind: story
size: 3
status: active
locus: frontierui
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
tags: [dev-ports, lanes, infra]
---

# FUI env-driven dev-server ports (FUI_*_PORT parity with WE's #1997)

FUI-locus infra slice, filed by the 2026-07-02 parked-item review as the tracked blocker #2081's
prose named but never filed. Make the FUI dev servers take their ports from env vars
(`FUI_DEMO_PORT` / `FUI_API_PORT` or equivalent) with 6080/6002 as the defaults — the FUI sibling of
WE's per-lane `WE_*_PORT` scheme (#1997). Today the ports are hardcoded in
`fui:package.json` dev scripts (`--port=6080` / `--port 6002`) and `fui:vite.config.mts`
(`port: 6002` + `:6080` proxy targets), so two lanes cannot boot collision-free WE+FUI pairs.
Consumer: #2081's runtime cross-origin iframe render check, which needs to boot a WE+FUI pair on
lane-scoped ports from the CLI.
