---
kind: task
parent: "1852"
status: open
priority: low
dateOpened: "2026-06-27"
dateStarted: "2026-07-01"
tags: []
---

# Promote ZERO-impl and no-backward-edge into the gate

Add two deterministic checks to `we:scripts/check-standards.mjs` that enforce, as errors, the two
foundational constellation invariants currently only judged by hand: (1) **ZERO standard
implementation in WE** — no runtime modules under `we:blocks/` / `we:plugs/`; (2) **no backward DAG
edge** — WE source must not runtime-import `@frontierui/*`. Both are codified in
`we:docs/agent/platform-decisions.md` ([#constellation-placement](../docs/agent/platform-decisions.md#constellation-placement),
[#we-fui-embed-boundary](../docs/agent/platform-decisions.md#we-fui-embed-boundary); #1282
ZERO-impl) but cannot be mechanized yet — see `we:audits/we-consistency-mechanizable-rules.md`
section B.

**Parked, not blocked-by-an-item:** the obstacle is tree state, not another card. WE source still
*legitimately* imports `@frontierui/plugs/*` (`we:blocks/renderers/jsx`, `we:blocks/trusted-html`,
`we:blocks/resource-loader`, …) because impl is mid-relocation to FUI (#1282 end-state, drained
incrementally via #658 / #1730 / #1047). A check added today would error on dozens of correct lines.

**Un-park trigger:** when `grep -rE "from ['\"]@frontierui" blocks/ plugs/` over the WE repo returns
zero (the relocation has fully landed), build the two checks and flip them on. Until then this stays
`priority: low` and the front-B watch (#1852) covers these rules by reading. *(Trigger scoped to
`blocks/ plugs/` only — the original `src/` term matched documentation `.njk` files
[`block-descriptions/*`, `research-descriptions/*`] whose example snippets reference `@frontierui`
permanently, making the trigger unreachable; those are docs, not WE runtime modules.)*

## Progress

- **Status:** parked (released `active → open`, `priority: low`) — un-park trigger not yet met.
- **2026-07-01:** Checked the trigger. `blocks/ plugs/` still carries **10 real runtime `@frontierui`
  imports** across the blocks mid-relocation to FUI: `router/` (×6), `trusted-html/` (×2),
  `jsx/render-strategy` (×1), `resource-loader/` (×1) — the impl #658 / #1730 / #1047 are draining.
  Building the gate checks now would error on all 10 correct lines. Fixed the un-park trigger scope
  (dropped `src/`, which counted permanent doc snippets). **Next:** re-check the trigger after the
  next relocation drain lands; build the two checks only once it returns zero.
