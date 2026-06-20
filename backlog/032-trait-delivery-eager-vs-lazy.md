---
kind: decision
size: 2
status: resolved
dateOpened: '2026-06-02'
dateStarted: '2026-06-08'
dateResolved: '2026-06-08'
codifiedIn: "one-off"
tags:
  - webtraits
  - lazy-loading
  - build-time
  - policy
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
---

# Default trait delivery: eager-bake vs split+lazy

When the Enforcer applies a declared trait at build time, does it bake the trait in eagerly (always applied, simplest) or emit a code-split chunk + a runtime defineLazy registration (on-demand load)? The richest option is build decides the split, runtime decides the load — automatic code-splitting + on-demand loading, exactly the 'Scale without Weight' mission. Decide the default and whether it is per-trait overridable.

## Ruling (2026-06-08)

**Delivery is a per-trait configurable *dimension*, not a fixed mechanic.** Both eager and
lazy are legitimate end-states (eager for tiny/always-on traits; lazy for heavy/conditional
ones), so by the dimension-vs-fixed-mechanic rule we expose `delivery: eager | lazy` per trait
rather than baking one global behaviour. "Build decides the split, runtime decides the load."

- **Default: `lazy`.** A declared trait with no explicit delivery is code-split + `defineLazy`'d,
  loaded on first DOM appearance — the "Scale without Weight" mission as the path of least
  resistance. Pop-in on first appearance is acceptable because traits are progressive
  enhancement (the base element is functional without the trait).
- **Override: `eager`** flag on the **trait-manifest entry** (the trait author owns it — they
  know whether the trait is tiny/always-on/first-paint-critical). Eager bakes the trait into the
  main bundle, synchronous, no pop-in. The shipped runtime already supports this (an eager
  `define` supersedes a pending lazy registration), so the override is near-free.
- **Deferred:** a per-*usage* (page-author) override of a trait's manifest default — plausible
  later, not built now.

The machinery (`defineLazy`, trait manifest, Enforcer) shipped in [#034](/backlog/034-webtraits-lazy-loading-path/).
The successor build — add the `delivery`/`eager` dimension to the manifest shape + Enforcer and
document the default in the webtraits spec — is tracked in [#200](/backlog/200-trait-delivery-default-eager-override/).
