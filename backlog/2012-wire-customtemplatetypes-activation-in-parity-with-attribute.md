---
kind: story
size: 5
parent: "1994"
status: open
blockedBy: ["2010"]
dateOpened: "2026-07-01"
tags: []
---

# Wire customTemplateTypes activation in parity with attributes

Slice B of #1994, blockedBy #2010. Implement the chosen parity-wiring resolution so customTemplateTypes activates alongside attributes across both boot models: unplugged register(customTemplateTypes) Plug-cascade + the plugged upgrade sites (or the shared seam, per #2010). No live behavior change yet — the registry has nothing live to upgrade until for-each migrates (slice C). Size provisional (5): resolution (a) ~15 sites may hold at 5 and become its own /split candidate; (b)/(c) drop it to ~3. Re-size once #2010 resolves.
