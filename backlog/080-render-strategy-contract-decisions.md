---
type: decision
status: open
dateOpened: '2026-06-06'
tags:
  - rendering
  - render-strategy
  - protocol
relatedReport: reports/2026-06-06-render-strategy-axis.md
relatedProject: webcomponents
crossRef: { url: /projects/webcomponents/#render-strategy-contract, label: Render Strategy contract }
---

# Finalize the Render Strategy contract's two open decisions

Two coupled forks in the [Render Strategy Protocol](reports/2026-06-06-render-strategy-axis.md) §7 must settle before the contract freezes past `concept`. Both have a recommendation; they need a nod, not a redesign.

- **`RenderInput` shape per strategy.** One tagged union keyed by strategy id, vs. distinct per-strategy input types. **Recommendation: tagged union**, validated by the registered provider — keeps one registry signature while letting each strategy carry its own payload (parsed template + binding map / `render()` thunk / reactive computation / imperative builder).
- **Re-render trigger ownership.** Does the host *call* `update()` on each Change Record, or does the strategy *subscribe* itself to its reactivity source? **Recommendation: the strategy subscribes** — it matches fine-grained reality (signals self-track) and lets mount-once strategies simply omit `update()`. The host stays out of the reactivity loop, preserving "no runtime magic."

Once ratified, encode the resolved shapes in the `protocol-render-strategy` section of `project-webcomponents.njk` and bump the protocol status.
