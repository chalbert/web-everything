# Observable-state registry — prep research for decision #1160

**Date:** 2026-06-20
**Decision:** [#1160](../backlog/1160-webcases-observable-state-registry-semantics-for-then-observ.md) — webcases observable-state registry semantics for `then.observe` grounding
**Research topic:** `/research/observable-state-registry/`
**Parent:** [#1038](../backlog/1038-webdocs-spec-surface-completeness-doc-manifest-cases-specs-w.md) (Cases-Spec slice) · **Consumer:** [#1162](../backlog/1162-cases-spec-completion-case-to-test-bridge-conformance-valida.md)

## The gap

`we:webcases/requirementValidator.ts` grounds every typed requirement slot HARD against a live, injected
registry — a reference that doesn't resolve is an `error` and fails validation *at author time*:

| Slot | Registry | Severity |
| --- | --- | --- |
| `role` | injected persona roster (#141/#166) | error |
| `given.{intent,dimension,value}` | `we:intents.json` (nested resolution) | error |
| `when.event` | `we:semantics.json` term | error |
| `then.protocol` | `we:protocols.json` id | error |
| `then.tier` | fixed `L1/L2/L3` vocab | error |
| **`then.observe`** | **none — no observable registry** | **`info` (un-groundable)** |

`then.observe` is the observable *state or event* the protocol exposes that the conformance case asserts.
It falls through to an `info` finding (`we:webcases/requirementValidator.ts:115-125`) because `we:protocols.json` models
no observable states. The decision: mint that registry — its vocabulary and its home — so `then.observe`
grounds hard like its siblings. Resolving it turns the Cases-Spec slice's last coverage gap (#1038) into
a small build.

## Prior art — the web platform already ships the vocabulary

The survey (MDN, WHATWG HTML custom-elements, WAI-ARIA states-and-properties, CSS `:state()`) returns a
precise **three-source** vocabulary for "an observable condition of a component", and the platform itself
draws the **state vs. event** distinction the slot's doc-comment conflates:

1. **WAI-ARIA states** — `aria-expanded`, `aria-invalid`, `aria-busy`, `aria-checked`/`-selected`/
   `-pressed`, `aria-current`. ARIA separates dynamic *states* from static *properties*. These are what
   testing libraries assert (`getByRole(…, { expanded:true })`, `toHaveAttribute('aria-busy')`).
2. **Custom states** — `ElementInternals.states` / `CustomStateSet` → CSS `:state(ident)`. Baseline since
   May 2024. The native way a custom element exposes its *own* internal states (`committed`, `loading`)
   to outside observers, readable from test code via `el.matches(':state(committed)')`. The standards-
   aligned home for a protocol-specific observable with no ARIA equivalent.
3. **DOM events** — `toggle`/`beforetoggle`, `change`, `input`, `invalid`. Discrete occurrences you
   *await*, not read.

**Why `kind` is load-bearing:** the case→test bridge emits `<!-- assert: protocol observe tier -->`
(`we:webcases/compileRequirement.ts:65`). A runner cannot execute that directive without knowing whether to **read a
state** or **await an event**. A flat string vocabulary starves the bridge (#1162) of that signal — so
each observable entry must carry a `kind`.

## Structure — the home is pre-decided by the `given` precedent

The validator resolves `given` *nested* — intent → its dimension → that dimension's value
(`we:webcases/requirementValidator.ts:91-101`), never against a flat global `we:values.json`, because a value has no
identity outside its dimension. The `then` side is symmetric: an observable has no meaning outside the
protocol that exposes it. By the same precedent the observable vocabulary co-locates **on the protocol
record**, and `then.observe` resolves *within* the already-resolved `then.protocol`.

This is reinforced on disk: the `validation` protocol summary already narrates *"Observable states/events
per level (control/group/form/nested)"* in prose (`we:src/_data/protocols/validation.json`). The protocol is
the de-facto owner already; formalizing types what it already claims, and rides the `protocols` registry
the validator already injects — no new injection seam.

## Per-fork classification (7-question pass)

| Question | Answer |
| --- | --- |
| Which layer? | **Protocol** (conformance vocabulary), WE-layer `@webeverything` data — the `then` side mirrors `given`'s intent side. |
| Protocol or intent dimension? | **Protocol** — a conformance-observable (verification target), not a UX axis. |
| Expose the whole axis? | Open/extensible **per protocol** — default-less core, each protocol declares its own set. |
| Fixed mechanic or dimension? | `kind` is a **fixed modeled attribute** (platform draws state/event); the *set* is open per protocol. |
| DI-injectable? | Already injected via `registries.protocols`; co-location adds **no new seam** (a point for Fork 1's default). |
| Most-permissive default? | **Progressive grounding** — hard only where declared, info otherwise. |
| Seam between intents? | N/A — it's the `then`/protocol seam, mirroring `given`/intent. |

## The three forks (each with its bold default)

- **Fork 1 — Home:** **co-locate on the protocol record** vs standalone `we:observables.json`. Flawed
  branch: standalone is a 2nd SoT + a flat global namespace where `expanded` collides across protocols.
  Confidence: **high**.
- **Fork 2 — Grammar:** **typed `{ id, kind: 'state'|'event', platform? }`** vs flat string list. Flawed
  branch: a flat list can't tell the bridge read-vs-await. `platform` = optional ARIA token / `:state()`
  ident / DOM event type (native-first). Confidence: **med-high** (kind is solid; the optional `platform`
  richness is the softer part).
- **Fork 3 — Rollout:** **progressive grounding** (hard where the protocol declares observables, info
  otherwise) vs flag-day. Flawed branch: flag-day breaks every currently-valid requirement (incl. the
  shipped fixture `we:webcases/__tests__/requirementValidator.test.ts:30`) until all 33 protocols are annotated, for no
  migration benefit. Confidence: **high**.

## Supported by default (not forks)

- `then.observe` *should* eventually ground hard — the item's stated goal (forced invariant, ratify).
- The registry is WE-layer `@webeverything` protocol data (classification Q1).
- Injected, never imported — the existing validator pattern is unchanged.
- Empty `observe` stays an `error` (already shipped at `we:webcases/requirementValidator.ts:116`).

## Graduation (post-ratify, not now)

A `blockedBy` chain in build order: extend the protocol schema + `RequirementRegistries` →
add `observables` to the protocols that have them (start with `validation`, `change-tracking`,
`audit-trail`) → flip `then.observe` to progressive-hard in the validator → thread `kind` through the
`<!-- assert -->` directive for the #1162 bridge. Each is an agent-ready slice.

## Sources

- [ElementInternals.states — MDN](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/states)
- [CustomStateSet — MDN](https://developer.mozilla.org/en-US/docs/Web/API/CustomStateSet)
- [CSS `:state()` — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/:state)
- [ARIA states and properties — MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes)
- [Supported States and Properties — WAI-ARIA 1.0, W3C](https://www.w3.org/TR/wai-aria-1.0/states_and_properties)
- [4.13 Custom elements — WHATWG HTML](https://html.spec.whatwg.org/multipage/custom-elements.html)
