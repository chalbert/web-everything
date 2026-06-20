---
kind: story
size: 5
parent: "203"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: "capabilities/strictness.ts (D5) + capabilities/cascade.ts (D6) + Validation-strictness & Scoped-binding-cascade sections on /capabilities/"
tags: [capability-provider, validation, strictness, conformance-tier, scoped-binding, cascade, native-first]
crossRef: { url: /backlog/203-capability-provider-resolution-architecture/, label: "D5 + D6 story of epic #203" }
---

# Validation strictness (D5) + scoped binding cascade (D6)

The two policy knobs that live in the base definition, per the **D5** and **D6** rulings in
[#203](/backlog/203-capability-provider-resolution-architecture/). Both are config values on the
binding/resolution layer; bundled because each is small and they share the base-definition home.

## Scope

### D5 — Validation strictness

- **One orthogonal `silent | warn | error` knob** in the base definition, **default `warn`**, mapped
  onto conformance tiers (error = strict, warn = standard, silent = lenient).
- **Where it applies (identically):** a rejected **concrete pin** (pinned an impl whose required
  capability is `capability-hard`) and a **policy** that resolves to a capability-hard tier (native-first
  found nothing eligible).
- **Rationale:** default `warn` honors progressive enhancement (a wrong guess degrades, not breaks); CI
  bumps to `error`; runtime PE-degradation uses `silent`.

### D6 — Scoped binding precedence

- **Plain nearest-scope-wins cascade:** base → app → view → fragment, most-specific overrides; borrow
  context-provider / CSS-cascade semantics.
- **Inheritance carries the slot value as written** — a policy stays a policy, re-resolved at the leaf
  in its own context. So `native-first` stays meaningful per-context (native on a Chrome view, custom on
  a Safari view) rather than freezing the parent's resolution. An unspecified scope inherits the parent's
  resolved slot value.

## DoD

- Strictness knob settable in the base + overridable per scope; the validator/resolver emit
  silent/warn/error per the knob; mapped to a conformance tier.
- Cascade demo: app sets `native-first`, a view pins concrete, a fragment overrides again — nearest
  wins; an un-overriding child re-resolves the inherited policy in its own context.
- `check:standards` green.

## Progress
- **Status:** resolved — both knobs built, tested, and surfaced on `/capabilities/`.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - **D5** `we:capabilities/strictness.ts` — one orthogonal `silent|warn|error` knob (default `warn`),
    `conformanceTierFor`/`strictnessForTier` (error↔strict, warn↔standard, silent↔lenient),
    `validateSlot()` reporting the same problem for a **rejected pin** and an **unresolvable policy**
    with `severity === strictness`, and `applyStrictness()` (throw/onWarn/swallow). 12 tests.
  - **D6** `we:capabilities/cascade.ts` — `cascade()` nearest-scope-wins over base→app→view→fragment;
    inheritance carries the slot **as written** (policy stays a policy); `resolveScoped()`
    re-resolves the inherited slot in the leaf's own provider context + validates under the effective
    strictness. 13 tests incl. the DoD demo (Chrome view → native `base-select`, Safari view → custom
    `face` from the *same* inherited `native-first`) and a fragment pin override.
  - Exported both from `we:capabilities/index.ts`; added **Validation strictness** + **Scoped binding
    cascade** sections to `we:src/capabilities.njk` (render live on `/capabilities/`).
- **Verify:** capability suite 48/48 green; `check:standards` 0 errors; tsc clean; page returns 200.
- **Notes:** demo sections on the page are descriptive prose (consistent with the existing native-first
  section) — making the resolver demo *computed not authored* is already tracked as open item #213.
