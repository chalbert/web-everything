---
kind: story
size: 5
parent: "1963"
status: active
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
tags: []
---

# Build the LightLeafElement persistent-host base class + pilot one leaf (badge) — the #2028 reference base

#2028 ratified the leaf shape (host-is-node for badge/tag/card/section-card/auto-heading; wrap-child for progress/meter) but built no reference base. Build the persistent light-DOM base class (`fui:blocks/light-leaf/LightLeafElement.ts`) + migrate one pilot leaf (badge) with role/aria-label/CEM placement per the ruling, `display:contents` only where a box breaks flex/grid. Unblocks the soft-7 migration #1974.

## Acceptance
- A `LightLeafElement` base at `fui:blocks/light-leaf/LightLeafElement.ts`: a **persistent** (non-self-erasing) custom-element host that carries its own class/`role`, applies `display:contents` only when a box would break flex/grid, and exposes `ElementInternals`/CEM per #2028's host-is-node ruling.
- **Badge** migrated off `fui:blocks/transient/TransientElement.ts` onto the new base as the pilot leaf; its accessible name / `role` land on the host per the ruling.
- Unit tests for the base (persistence, `display:contents` gating, aria/CEM placement) and the badge pilot; existing badge consumers/demos updated for the zero-wrapper→host DOM change.
- The remaining soft-6 (tag, section-card, auto-heading, meter, progress, card) are **out of scope** — they follow in #1974 once this reference base + pilot proves the shape.
