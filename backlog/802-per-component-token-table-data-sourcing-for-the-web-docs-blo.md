---
type: decision
workItem: story
size: 2
parent: "623"
status: open
dateOpened: "2026-06-16"
tags: []
---

# Per-component token-table data sourcing for the Web Docs /blocks/ panels

Decide how a per-component token table on /blocks/{id}/ is sourced. webtheme/defaultTokens.ts:90-104 holds a component token tier (button/card DTCG overrides) but it covers ~2 of 69 blocks, is keyed by component name not block.id, and webtheme/ is not exposed to 11ty (no src/_data theme/token data). Rule the data wiring (expose the component tier to the docs data layer), the block.id to component-token-key mapping, and the table's scope (component overrides vs the aliased primitives behind them).
