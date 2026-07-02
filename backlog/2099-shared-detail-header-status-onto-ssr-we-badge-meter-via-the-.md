---
kind: story
size: 2
parent: "2021"
status: open
blockedBy: ["2098"]
dateOpened: "2026-07-02"
tags: []
---

# Shared detail-header status onto SSR we-badge (+ meter) via the shared status macro

Convert the shared projectStatus macro internals (we:src/_includes/project-status.njk:1-8) to the ratified #2019 shape — status as SSR we-badge, the status-meter row kept as trusted HTML beside it (we:scripts/lib/component-render-build-hook.cjs:246-266 precedent) — using the #2098 primitive. Call sites in the 10 importing templates (block/intent/adapter/plug/resource/state/demo/research-topic/project pages + we:src/demos.njk) unchanged: one macro conversion serves every detail header. JS-off correct; Playwright before/after.
