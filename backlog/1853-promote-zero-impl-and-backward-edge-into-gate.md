---
kind: task
parent: "1852"
status: open
priority: low
dateOpened: "2026-06-27"
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

**Un-park trigger:** when `grep -rE "from ['\"]@frontierui" blocks/ src/ plugs/` over the WE repo
returns zero (the relocation has fully landed), build the two checks and flip them on. Until then this
stays `priority: low` and the front-B watch (#1852) covers these rules by reading.
