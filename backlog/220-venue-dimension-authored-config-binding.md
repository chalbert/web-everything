---
kind: story
size: 3
parent: "203"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: "capabilities/cascade.ts — Binding.venue (authored, cascaded nearest-scope-wins, build default) + EffectiveBinding.venue/venueSource + effectiveProvider() (explicit provider overrides; else venue→providerForVenue; else fallback); resolveScoped/resolveScopedSlot take an optional VenueConfig; venue suite in capabilities/__tests__/cascade.test.ts; documented on /capabilities/"
tags: [capability-provider, venue, cascade, binding, authoring, config]
crossRef: { url: /backlog/208-runtime-edge-venue-provider-impls/, label: "Authoring surface for the venue dimension built in #208" }
---

# Wire the venue dimension into authored base/project config

[#208](/backlog/208-runtime-edge-venue-provider-impls/) made the three venues **selectable in code**
(`providerForVenue` / `resolveAtVenue` route `build` / `runtime` / `edge` to the right provider impl),
but there is **no authored field** that declares a venue on a real base definition or project yet —
the selection is programmatic. #203 calls venue "an optional, configurable dimension … settable in the
base definition and overridable per project"; this story lands that authoring surface.

## Scope

- **Authorable `venue` field** — let a base definition declare `venue: build | runtime | edge` (default
  `build`) and a project override it, the same way the [#207](/backlog/207-validation-strictness-scoped-binding-cascade/)
  cascade carries `slot` / `strictness` / `provider`. The cleanest shape is a `venue?` on the
  cascade `Binding`, cascaded nearest-scope-wins like the others, that *produces* the provider context
  rather than being a free-standing provider — so the cascade resolves `venue → provider` instead of
  taking a pre-built provider.
- **Reconcile with `Binding.provider`** — today a scope supplies a concrete `CapabilityProvider`. Decide
  whether `venue` replaces that (venue → provider via `providerForVenue`) or composes with it (venue
  picks the impl class, an explicit provider overrides). Keep no-magic-on-absence: the base must set a
  venue (or inherit `build`).
- **DoD** — a project can author `venue: edge` and have `resolveScoped` route through the edge provider
  with no code change; the `/capabilities/` page documents the authored field; `check:standards` green.

## Note

Small, bounded follow-up — the mechanism (`providerForVenue`, `DegradingProvider`, the cascade) all
exists; this is the declarative binding glue on top.

## Progress
- **Status:** resolved — `venue` is now an authored cascade field that produces the provider.
- **Branch:** docs/standard-authoring-workflow
- **Done:** added `Binding.venue?` (cascaded nearest-scope-wins, `build` default, no magic-on-absence) +
  `EffectiveBinding.venue`/`venueSource`; new `effectiveProvider()` resolves the context with precedence
  **explicit provider › venue→`providerForVenue` › fallback** (the reconcile call: explicit provider is
  the escape hatch, venue picks the impl class otherwise); `resolveScoped`/`resolveScopedSlot` take an
  optional `VenueConfig`; 5 new venue tests in `we:cascade.test.ts` (88 capabilities tests green);
  `/capabilities/` documents the authored field. check:standards 0/0; tsc clean; 11ty build green.
- **Next:** —
- **Notes:** `venue: edge` flips the winner through the `DegradingProvider` with no code change (proven);
  a venue with no `VenueConfig` stays declarative and falls to the fallback (no magic).
