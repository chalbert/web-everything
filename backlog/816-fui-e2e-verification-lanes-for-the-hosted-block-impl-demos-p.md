---
type: issue
workItem: story
size: 3
parent: "658"
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: demos/__tests__/playgrounds.spec.ts
tags: []
---

# FUI e2e verification lanes for the hosted block-impl demos (playground + chromium-sw durable)

The block-impl demos #813 ported to frontierui/demos/ (background-task-surface, data-grid playgrounds + durable-tier-verification) have NO FUI e2e lane: FUI's playwright.config has only a 'chromium' project and no spec asserting playgroundReady for the ported playgrounds, nor a 'chromium-sw' service-worker lane for the durable page. Today that coverage lives in WE (plugs/__tests__/e2e/playgrounds.spec.ts + blocks/__tests__/e2e/durable-tier-verification.sw.spec.ts) and is orphaned when #697 deletes WE's block-impl + specs. Author FUI playground e2e (playgroundReady green for bg-task + data-grid) and a chromium-sw project + durable spec, so #697's WE-side deletion does not regress coverage. locus:frontierui.

## Progress — authored + ran the FUI e2e lanes (2026-06-16, batch-2026-06-16)

The #813-ported demos (`frontierui/demos/{background-task-surface-demo,data-grid-demo,durable-tier-verification}`)
had no FUI e2e coverage; re-homed it from WE:

- **Playground lane** — `demos/__tests__/playgrounds.spec.ts`: asserts each playground loads with
  `playgroundReady === true`, all badges green (`.summary.pass`, no `.badge.fail`, `playgroundPass > 0`),
  zero console/page errors. FUI ships no `demos.json` registry, so the playground set is an explicit list
  (bg-task + data-grid) — extend as more port over.
- **Service-worker lane** — added a `chromium-sw` Playwright project (`serviceWorkers: 'allow'`) and gave
  the default `chromium` project a `**/*.sw.spec.ts` ignore so the durable spec runs only in the SW lane.
  `demos/__tests__/durable-tier-verification.sw.spec.ts` (ported from WE) proves register → hard-reload →
  rehydrate survives the real `reloadDurabilityAdapter`, plus the forced-unavailable degrade + guard re-arm.
- **testMatch** extended with `demos/**/__tests__/**/*.spec.ts`.
- **Verified**: `npx playwright test demos/__tests__/` → 4 passed (2 playground + 2 durable-SW) against the
  live FUI Vite origin (:3001). FUI `check:standards` green (0/0). Closes the #697 orphaning gap.
