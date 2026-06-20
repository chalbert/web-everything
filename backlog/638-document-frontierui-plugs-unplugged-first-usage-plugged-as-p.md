---
kind: task
status: open
blockedBy: ["170"]
dateOpened: "2026-06-14"
tags: []
---

# Document @frontierui/plugs — unplugged-first usage, plugged-as-POC, per-plug API reference

Write proper documentation for the plugs runtime in its new home (@frontierui/plugs): lead with the unplugged, non-invasive library API (register/upgrade/downgrade) as the supported real-app surface; present the plugged bootstrap mode as a POC/demo only; and give a per-plug API reference. Reflects the [Constellation placement](docs/agent/platform-decisions.md#constellation-placement) rule (origin #606) that plugs is implementation owned by Frontier UI and that unplugged is the canonical way to consume it.
