---
type: idea
workItem: story
size: 5
parent: "203"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: "capabilities/resolver.ts (resolveSlot / native-first) + capabilityMatrix native marker"
tags: [capability-provider, resolver, native-first, eligible-tiebreak, intents, resolution]
crossRef: { url: /backlog/203-capability-provider-resolution-architecture/, label: "Resolver story of epic #203" }
---

# native-first resolver — eligible → lightest → native-tiebreak

The resolution logic that consumes the capability provider ([#204](/backlog/204-capability-vocabulary-provider-interface-matrix/))
to fill an impl-provider slot. Per [#203](/backlog/203-capability-provider-resolution-architecture/)
and the [#025](/backlog/025-droplist-native-substrate-fork/) ruling.

## Scope

- **Slot resolution** — a provider slot holds either a **concrete impl** (= pin, no resolution) or a
  **named policy** (= resolve). `native-first` is the first-class policy the shipped base uses.
- **`native-first` algorithm** — `eligible → lightest → native wins ties`:
  1. **Eligible** = every required capability ID (from the intent → required-capabilities mapping)
     tiers to `native-ok` or `polyfill-ok` on the impl (none `capability-hard`). Query the provider —
     do **not** hard-code capability facts.
  2. **Lightest** = fewest polyfills / least JS over baseline (the `polyfill-ok` count is the cost
     proxy).
  3. **Native wins ties** — among equally-light eligibles, prefer the native substrate.
  - This is *check-before-choose* (rejected the privileged-before-check alternative in #025): never
    commit to native then discover a `capability-hard` required capability.
- **Venue-agnostic** — the same algorithm runs at build / runtime / edge; only where/when differs
  (the venue dimension + runtime/edge provider impls are #208). This story targets the default `build`
  venue against #204's static matrix.
- **DoD** — a droplist slot set to `native-first` resolves to the native `base-select` impl where all
  required intents are native-ok/polyfill-ok, and falls to the custom FACE impl where a required
  capability is `capability-hard` on native. Demo proves both branches. `check:standards` green.

## Progress

- **Status:** resolved (2026-06-08)
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - **Resolver** — [capabilities/resolver.ts](../capabilities/resolver.ts): `Slot` (pin vs
    `{policy:'native-first'}`), `resolveSlot()`, `evaluate()` (pure per-impl eligibility reports),
    `pickNativeFirst()` (eligible → lightest → native-tiebreak), `requiredCapabilitiesFor()` (intent
    union), `NoEligibleImplError` / `UnknownPolicyError`. Check-before-choose: eligibility computed for
    every impl before a winner is picked. Re-exported from `capabilities/index.ts`.
  - **Native marker** — `capabilityMatrix.json` `base-select` row gets `"native": true`; provider gains
    `isNative(impl)` (added to the `CapabilityProvider` interface + `StaticMatrixProvider`); the
    polyfill-ok count is the lightness cost proxy.
  - **Both DoD branches proven** — [capabilities/__tests__/resolver.test.ts](../capabilities/__tests__/resolver.test.ts)
    (10 tests): native branch resolves the droplist slot to `base-select` on the shipped matrix; fallback
    branch resolves to `face` against a constrained-target provider (a required cap `capability-hard` on
    native) — the venue-agnostic point. Plus lightest, native-wins-ties, pin short-circuit,
    check-before-choose, and the no-eligible-impl throw.
  - **Validator** — `check:standards` 6c-bis: `native` is boolean when present; at most one impl may be
    native (unambiguous substrate for the tiebreak).
  - **Catalog** — `/capabilities/` gains a *Native-first resolution* section (algorithm + droplist
    worked example, both branches) and a `native` badge on the substrate's matrix column.
- **Next:** adapter table (#206), strictness + scoped cascade (#207, decides how venues react to
  `NoEligibleImplError`), runtime/edge venue providers (#208, where the fallback branch fires on real
  targets). Follow-up filed: #213 (page worked-example is authored, not computed — drift-guard).
- **Notes:** Gates green — full vitest 1645 pass / 7 skip (was 1635 + 10 new), `check:standards` 0
  errors, `/capabilities/` 200 on :8080 and :3000. base-select strictly dominates FACE in the build
  matrix, so the fallback-to-FACE branch only fires under a constrained-target provider (#208's
  runtime/edge venues) — demonstrated here via a fixture, the honest venue-agnostic proof.
