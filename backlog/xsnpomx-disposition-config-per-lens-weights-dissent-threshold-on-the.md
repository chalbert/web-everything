---
kind: story
size: 5
parent: "2633"
status: open
scope: ["we:scripts/lib/"]
dateOpened: "2026-07-24"
tags: []
---

# Disposition config — per-lens weights + dissent threshold on the #2633 contract

Extend the care→jury contract with per-lens/juror weights, a dissent-tolerance threshold, and the accept-best vs present-unless-all-agree setting, with per-decision override.

**Ratified forward-fit.** The jury-of-#2576 ruling declared the #2633 care→jury contract **extensible to per-lens weights + a dissent threshold** — build the contract to receive these, don't build the weighting now. Decision record: https://claude.ai/code/artifact/273a2dbd-402d-4bd4-98f4-ec45475a7052

Extend the #2633 contract with: (1) **per-lens / per-juror weights** so some lenses count more; (2) a **dissent-tolerance threshold** governing how much disagreement is allowed before a fork escalates; (3) the **accept-best ↔ present-unless-all-agree** setting; and (4) a **per-decision override** of all three. Config half of the resolver-spined F3 shape — the stateless roster recompute reads this contract. Lives in the WE core at [we:scripts/lib/](scripts/lib/).
