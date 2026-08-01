---
bornAs: x1sn33r
kind: decision
parent: "2804"
status: resolved
dateOpened: "2026-08-01"
dateResolved: "2026-08-01"
codifiedIn: reports/2026-07-31-ui-fidelity-gate-design.md
tags: [plateau-loop, conveyor, ui-fidelity, decision, slice-uifg]
---

# UI-fidelity oracle tightness — floor-only vs perceptual-advisory vs jury-mandatory

How hard the **visual** layer of the UI-Fidelity Gate ([#2804]) bites. The deterministic structural floor
(DOM grammar + geometry + chrome-role + theme-equality) is settled and non-negotiable; this decision is only
about the *perceptual pixel* layer above it.

## Forks
- **A — floor only.** Gate on the structural floor; no perceptual comparison. Never flakes, never muted; blind
  to within-tolerance miscolor / wrong-glyph.
- **B — floor gates + perceptual diff advisory.** The boolean floor is the only thing that blocks `resolved`;
  the perceptual diff surfaces to reviewer/jury but never gates. Catches more, still un-mutable — the floor
  stands even if pixels are ignored.
- **C — floor + perceptual mandatory in the jury.** Hardest guarantee, but puts a tolerant pixel lens in a
  *blocking* seat — the exact surface that rots under drift pressure (a flaky blocker gets muted, and the
  guarantee collapses).

## Ruling — B (2026-07-31)
**B.** The deterministic floor is the part that structurally cannot be argued out of or muted, and it already
catches all six console-board failure modes. Ship the jury `visual` lens ([#2816]) **advisory-until-trusted**
— it advises, it does not gate.

## Residual — C parked
Promote toward **C** only on evidence. **Reopen trigger:** once the registry-anchored target has a **known
false-block rate**, so a blocking pixel lens won't rot. When it reopens, C may land as a **configurable
oracle-tightness dial** rather than a hard flip (deferred; the launch stance is best-on-merit, not configurable).

Codified in the design reference §5 and enforced by the gate slices under [#2804].
