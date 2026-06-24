---
kind: story
size: 5
status: open
locus: frontierui
parent: 1353
dateOpened: "2026-06-24"
tags: [frontierui, blocks, fui-build-gate]
---

# FUI build: resource-loader backgroundLoad + background-task handoff impl + fixtures

FUI build: port `we:blocks/resource-loader/backgroundHandoff.ts` + `we:blocks/resource-loader/handoffContract.ts` into `fui:blocks/resource-loader/` with fixtures (today FUI has no backgroundLoad/handoff). Unblocks re-hosting the loader-background-handoff demo FUI-side and deleting the WE family (#1353).
