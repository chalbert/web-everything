---
kind: decision
size: 2
status: resolved
dateOpened: '2026-06-06'
dateResolved: '2026-06-08'
graduatedTo: "protocol:render-strategy"
codifiedIn: "one-off"
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

Once ratified, encode the resolved shapes in the `protocol-render-strategy` section of `we:project-webcomponents.njk` and bump the protocol status.

## Resolution

Both forks ratified 2026-06-08, per their recommendations and for consistency with the sibling `CustomChangeStrategy`:

- **`RenderInput` shape → tagged union keyed by strategy id.** Decisive precedent: `CustomChangeStrategy` (Web States) deliberately keeps a **non-generic** registry (`track(target: object, …)`, narrowed internally) rather than `CustomChangeStrategy<T>`. The render contract mirrors it — one `RenderInput` union, validated by the registered provider — instead of a generic `RenderStrategy<TInput>` that would re-couple callers (JSX adapter, `<component>`) to concrete strategies. Added `readonly key` to `RenderStrategy` for full symmetry with `CustomChangeStrategy.key`; the union's `strategy` discriminant equals that key.
- **Re-render trigger → the strategy subscribes itself.** Host stays out of the reactivity loop; mount-once strategies omit `update()`. Preserves the Change ⁄ Render seam (detect vs commit) and "no runtime magic."

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - Encoded the `RenderInput` tagged union + `readonly key` + the strategy-subscribes normative note in the `protocol-render-strategy` Contract section of `we:src/_includes/project-webcomponents.njk`.
  - Added the **Render Input** term to `we:src/_data/semantics.json`.
  - Bumped `render-strategy` protocol `concept → draft` in `we:src/_data/protocols.json` (+ summary refreshed) and regenerated `we:AGENTS.md` inventory.
  - `check:standards` green (0 errors).
- **Next:** none — downstream implementation (declarative-static provider #077, lowering compiler #078, toggle UI #079) already resolved.
- **Notes:** This is a decision item; it graduated into the existing `protocol:render-strategy`, no new entity.
