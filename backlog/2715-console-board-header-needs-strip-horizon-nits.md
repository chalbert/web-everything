---
bornAs: xzb1yg6
kind: story
size: 2
parent: "2555"
status: open
dateOpened: "2026-07-27"
tags: [plateau-loop, console, console-board, header, needs-strip, delivery-horizon, a11y, canonical-2554, slice-2555]
---

# Console board needs-strip + horizon convergence nits (canonical)

A cluster of small, region-local convergence nits. Re-anchored 2026-07-28 off the v68 baseline onto the
canonical §6/#2554 artifact. Two of the three original nits align; the third was **reversed** — it proposed
folding away two first-class canonical regions.

## Nits
- **Zero-count stalled pill (a11y — keep, tightened).** The needs-strip renders `0 stalled` with the amber `⚠`
  treatment even at count 0 — color signals "attention" when there is none. Drop the warning cue (neutral
  treatment) at count 0, **and** suppress the ⚠ we-breathe pulse (`attn-stalled-pulse`), not just the color.
- **Delivery-horizon label (keep, canonical wording).** The dashed horizon line carries no label. Add **one
  mono, lev-colored label** on the single dashed "stop" line that spans all lanes at one fixed y — per the
  canonical `center-single-horizon`, not the v68 label text.
- **Below-board chrome — REVERSED.** The original nit offered to fold/hide the `OFF-LANE POOL` and the
  `All card-states — reference` disclosure to match v68's framing. **Do not fold them.** Canon makes the Lane
  pool a first-class region ([#2790]) and this board **is** the state reference (the header `reference`
  pill, [#2791]). Conform their naming/chrome to canon instead of reconciling them away.

## Acceptance
The needs-strip shows no false warning cue **and no pulse** at a 0 count; the delivery-horizon line carries one
mono lev-colored label at a single fixed y across all lanes; the Lane pool and card-states reference are
**retained** and conformed to canon (not hidden). Judged against the **ratified** §6/#2554 grammar (binding
now); any pixel comparison is **gated on** the [#2796] baseline flip that retires v68
`plateau-app:tests/visual/baselines/board.png` — not measured against a canonical baseline that does not yet
exist. Both themes; `plateau-app` `npm test` + `we:` `check:standards` pass.
