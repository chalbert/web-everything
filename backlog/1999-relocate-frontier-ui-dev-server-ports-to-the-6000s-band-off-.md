---
kind: story
size: 2
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# Relocate Frontier UI dev-server ports to the 6000s band (off WE's 3000/8080 band)

Implements #1996 Fork 2's per-repo bands. Frontier UI's dev servers currently sit at vite 3001, MaaS vite 3002, 11ty 8082 (frontierui:package.json) — inside WE's 3000/8080 band. Relocate them to FUI's own 6000s band (5000/7000 are macOS AirPlay/ControlCenter-reserved; 6000 verified free) so the constellation's per-repo bands don't overlap: WE 3000+/8080+, plateau-app 4000+, FUI 6000+. Cross-repo edit in frontierui:package.json + its vite config files + any hardcoded proxy targets.
