---
bornAs: xs7cyyh
kind: story
size: 3
tier: pinned
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/operations/deliver-item-wrapper.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Builder routes a build agent's 'not buildable' / 'already done' report automatically instead of holding it forever

Live 2026-09-29: build agents correctly declined three items and the build daemon put each into build-dispatch-holds, where they sit with no owner: #4295 ('spec not buildable as written within declared scope: the enforcement call sites are all outside scope'), #4380 ('spec already done on main: commit b93d13e29 … card just needs resolving'), #4108 ('spec superseded … re-scope or close'). Nothing acts on the hold, so the card never gets fixed or resolved and only an operator noticing moves it. MVP in the build daemon's hold path (we:skills-src/conveyor/build-dispatch-daemon.mjs and the delivery wrapper's outcome classification, we:scripts/operations/deliver-item-wrapper.mjs): classify the agent's report into (a) already-done → run the sanctioned resolve with graduatedTo = the cited commit, landed via a lane PR; (b) out-of-scope / spec-wrong → send the card to prepare (re-scope) with the agent's finding attached, and release the hold once re-prepared; (c) anything else → open a health finding naming the item and reason. Must: tests for the three routes; soak break (held item never moves → routed) RED before / GREEN after; live proof: #4380 resolves itself and #4295 goes to prepare with its finding.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
