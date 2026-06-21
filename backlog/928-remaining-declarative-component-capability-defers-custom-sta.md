---
kind: story
size: 3
status: parked
parkedReason: deferred
dateOpened: "2026-06-18"
tags: [webcomponents, component, declarative, deferred]
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# Remaining declarative <component> capability defers (custom states, manual slots, shared stylesheets)

Capture-for-later home for the three declarative-`<component>` capabilities that epic [#076](/backlog/076-component-declarative-wc-apis/) deliberately deferred rather than built. Parked because each is platform-blocked or low-value today, not because the design is open — none is buildable now, so there is nothing to slice. Split out of the resolved #076 body so a resolved epic doesn't act as the only discovery surface. Revisit when its trigger fires.

## Deferred capabilities

- **`attachInternals` → custom states** (DC-14) — seeding-only `ElementInternals.states` is low-value on its own. **Revisit:** a concrete use that needs a declaratively-seeded custom state hook.
- **Manual slot assignment** — `slotAssignment:'manual'` has no Declarative Shadow DOM attribute; opting in renders empty slots without a JS `slot.assign()` layer (footgun). **Revisit:** the [#852](/backlog/852-behavior-extends-tier-2-enhancement-hook-on-component-dc-5-r/) behavior hook makes a tier-3 `slot.assign()` spelling safe to expose.
- **Shared stylesheets** — `<style>` in template covers per-component; cross-instance `adoptedStyleSheets` sharing has no declarative form. **Revisit:** a platform/DSD spelling for shared constructable stylesheets appears.

Reactive bindings — the fourth #076 defer — is **not** here: it is already tracked by DC-4 [#042](/backlog/042-component-reactive-depth/) (resolved) + [#792](/backlog/792-dc-4-binding-layer-compile-time-expr-contract-observe-reflec/), and stays platform-blocked on Template Instantiation / DOM Parts.
