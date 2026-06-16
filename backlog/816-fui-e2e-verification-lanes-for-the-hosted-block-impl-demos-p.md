---
type: issue
workItem: story
size: 3
parent: "658"
locus: frontierui
status: open
dateOpened: "2026-06-16"
tags: []
---

# FUI e2e verification lanes for the hosted block-impl demos (playground + chromium-sw durable)

The block-impl demos #813 ported to frontierui/demos/ (background-task-surface, data-grid playgrounds + durable-tier-verification) have NO FUI e2e lane: FUI's playwright.config has only a 'chromium' project and no spec asserting playgroundReady for the ported playgrounds, nor a 'chromium-sw' service-worker lane for the durable page. Today that coverage lives in WE (plugs/__tests__/e2e/playgrounds.spec.ts + blocks/__tests__/e2e/durable-tier-verification.sw.spec.ts) and is orphaned when #697 deletes WE's block-impl + specs. Author FUI playground e2e (playgroundReady green for bg-task + data-grid) and a chromium-sw project + durable spec, so #697's WE-side deletion does not regress coverage. locus:frontierui.
