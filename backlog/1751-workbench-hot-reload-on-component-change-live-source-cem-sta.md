---
kind: story
size: 3
parent: "746"
status: open
dateOpened: "2026-06-24"
tags: []
---

# Workbench hot-reload on component change (live source/CEM + stage refresh)

The workbench must hot-reload when a block's component source changes in dev, so the live stage and the source/CEM panels never go stale against the edited element. Pairs with #1731's dev crossing mechanism (FUI MaaS middleware generates source/CEM live in-memory per request / on file-watch): when the watched component file changes, the workbench should re-fetch the source/CEM data route and re-mount/refresh the live stage — without a full reload where the custom-element identity allows it. Dev-only ergonomics over the #1731 serve route; parent #746.
