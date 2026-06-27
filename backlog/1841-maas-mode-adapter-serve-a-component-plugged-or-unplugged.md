---
kind: story
size: 3
parent: "1836"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: none
tags: []
---

# MaaS mode adapter: serve a component plugged or unplugged

Add a mode dimension to the module service so it can serve each component in plugged or unplugged form. Extend we:blocks/renderers/module-service/moduleService.ts and the serve-path grammar with a mode parameter alongside the existing form, target and strategy axes, and provide the adapter that emits the chosen mode. Independent of the default-mode call — this slice just makes both modes serveable.
