---
kind: story
size: 3
parent: "1073"
status: parked
blockedBy: ["1391"]
dateOpened: "2026-06-19"
tags: []
---

# Dev-browser opt-in surface for the Tier-2 vision tier

Slice D of #1073: the opt-in download + UI that surfaces the Tier-2 rich output inside the dev browser ([monetization](docs/agent/platform-decisions.md#monetization), #141) — download/invoke/render. Gated on the dev-browser **shell** existing — the shell build is now filed as [#1391](/backlog/1391-dev-browser-shell-build-chromium-shell-embedding-plateau-app/) (#141's staged successor), which this slice `blockedBy`-depends on. Until #1391 ships, slice C's (#1082, resolved) standalone demo is the demoable home for the Tier-2 output. (Earlier prose blocker #1082 is resolved as of 2026-06-19; the real remaining gate is the shell, #1391.)
