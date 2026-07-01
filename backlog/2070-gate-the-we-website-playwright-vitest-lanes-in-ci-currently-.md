---
kind: story
size: 3
status: active
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: [testing, ci, playwright, vitest, coverage, harness]
parent: 2061
---

# Gate the WE-website Playwright + vitest lanes in CI (currently local-only)

The WE-website test suite is real but runs **nowhere in CI**. Both GitHub workflows (`we:.github/workflows/cla.yml`, `we:.github/workflows/publish-contracts.yml`) execute only the CLA check and `npm run check:standards` — which by design never renders a page or boots a browser. So the entire browser/unit suite (smoke, a11y, visual, interaction, unit/vitest, and the block/plug e2e specs under `we:blocks/__tests__/`) is a **developer-local gate only**; a regression that a green local run would catch ships if the author skips it. Surfaced by the #2061 harness audit as its single highest-value gap. Add a CI job (or extend one) that runs the deterministic/self-contained lanes — the interaction lane (private :3137 fixture server, no live data) and the vitest unit lane are CI-safe today; the live-server lanes (a11y/smoke/content/visual) need a build-then-serve step and tie into the #800 rendered-site regression harness. Scope this to wiring + a stable subset; the live-render lanes can land behind #800.

## Boundaries
- The visual and content lanes have platform-tagged baselines / dev-server-lag caveats — CI-home those under #800, not here.
- Start with the CI-safe lanes (interaction + vitest); do not force-green the live-server lanes.

## Lineage
Filed under #2061 (review all WE-website test-coverage harnesses). Re-filed at #2070 to yield the #2068 id to the pre-existing FUI-directive-marker item (parallel-batch id collision, batch-2026-07-01-1965-2052).
