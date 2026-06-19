---
type: decision
workItem: story
size: 2
status: resolved
dateOpened: '2026-06-02'
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
tags:
  - base-select
  - adapter
  - droplist
  - native-first
relatedReport: reports/2026-06-02-native-platform-substrate.md
# Former URL before the NNN-prefix migration (#110 old-slug redirect — keeps the old link alive):
formerSlugs: [base-select-first-class-adapter]
---

# Promote appearance:base-select to a first-class adapter?

Once customizable `<select>` (`appearance: base-select`) ships in more than one engine, is it worth a first-class droplist adapter, or does the custom-component path stay canonical? Currently Chromium-only and not polyfillable.

## What two later rulings already settled

- **[#024](/backlog/024-droplist-cross-root-aria-mandate/): base-select is a sanctioned _co-equal_ substrate, no default.** The custom-component path is *not* "canonical" over it — neither is privileged. So the original framing ("does custom stay canonical?") is moot: they're peers.
- **[#025](/backlog/025-droplist-native-substrate-fork/) → [#203](/backlog/203-capability-provider-resolution-architecture/): `native-first` is an eligible-tiebreak resolver policy.** base-select is the "native" impl that policy selects where eligible; the **capability provider gates eligibility per-browser**, so "Chromium-only" is *already handled* by the resolver — an unsupported target degrades to the custom impl, not a break.

## Concrete code to look at — base-select is *already* a first-class resolver impl

The substantive work is **already done at the capability-resolver layer (#206)** — base-select is a registered impl row, peer to the custom `face` impl, with full per-capability tiers:

- [`we:src/_data/capabilityMatrix.json:33-57`](../src/_data/capabilityMatrix.json) — the `base-select` impl row (`"native": true`, `label`, `summary`, and a `tiers` map: `customizable-select: native-ok`, `cross-root-aria: native-ok`, etc.). The `face` row above it (`:9-32`) is the custom counterpart (`customizable-select: capability-hard`). The header comment ([`we:capabilities/index.ts:32-36`](../capabilities/index.ts)) notes these `impls[]` rows are *"the single source of truth… the catalog, the provider, and the resolver all read the same registration. Adding an impl = one row."*
- [`we:capabilities/runtime.ts:64`](../capabilities/runtime.ts) — `'customizable-select': () => cssSupports('appearance: base-select')` — the live per-browser eligibility detector. This is what makes "Chromium-only" safe: where unsupported, base-select isn't eligible and the resolver degrades.
- [`we:capabilities/resolver.ts:145`](../capabilities/resolver.ts) — `pickNativeFirst()`, the eligible→lightest→native-wins-ties algorithm.
- [`we:capabilities/__tests__/resolver.test.ts`](../capabilities/__tests__/resolver.test.ts) (native branch resolves to `base-select`; fallback branch falls through to `face`) and [`we:capabilities/__tests__/edge.test.ts:115-137`](../capabilities/__tests__/edge.test.ts) (base-select resolves at the edge venue and *degrades, not breaks*, when a capability is missing) — proof both branches already work.

**What is NOT done, and what the matrix row reveals:**

1. The `base-select` row carries **no `status`/availability field** — it's presented as a fully-equal peer of `face` despite being single-engine.
2. base-select is **absent from the public adapters catalog** [`we:src/_data/adapters.json`](../src/_data/adapters.json) (the rendering/syntax/library adapter index rendered at `/adapters/`), and has no detail page ([#216](/backlog/216-capability-adapter-detail-pages/)).

So the live question is narrow: **base-select is already first-class where it counts (the resolver). Do we (a) surface it in the public adapters catalog + detail page, and (b) add an honest single-engine status — or leave it resolver-only?**

## Options

- **A — Ratify first-class; close the two gaps at `concept` status (recommended).** It already is the `native-first` pick (capabilityMatrix row + resolver). Add it to `we:adapters.json` (Library/Native group) at `status: concept` with a "production when a 2nd engine ships" note, and optionally an `availability` hint on the matrix row — *without* changing resolution behavior, since the runtime detector + tiers already degrade correctly (`we:resolver.test.ts` fallback branch). Makes the public surface match the resolver reality, consistent with #024's co-equal stance.
- **B — Leave it resolver-only; don't surface publicly until multi-engine.** Tradeoff: half-incoherent — it's *already* a peer of `face` in the resolver with no gate, so "defer" only hides it from `/adapters/`, not from the resolver. Leaves the public catalog out of sync with shipped behavior.
- **C — Add a hard availability gate** (exclude base-select from the default build-matrix until a 2nd engine). Tradeoff: discards the graceful per-capability degradation the resolver already does correctly (proven in the tests); more conservative than the substrate facts require.

## Resolved — base-select is an *implementation*, not a standard (2026-06-11)

**The A/B/C framing above mis-cast an implementation as a standards artifact.** The correcting insight: the droplist *standard* is the family + its intents/capabilities; `base-select` and `face` are two `impls[]` rows in [`we:capabilityMatrix.json`](../src/_data/capabilityMatrix.json) that *satisfy* it — implementation substrates, not standards. There is **no protocol/standard to author here**, and nothing graduates to a Protocol entity.

**Ruling:**
1. **Recognition (the only standards-layer piece) is already done.** base-select is a registered resolver impl (`we:capabilityMatrix.json:33-57`), picked via `native-first` where eligible, with per-browser eligibility gated by [`we:runtime.ts:64`](../capabilities/runtime.ts). #024 already settled it as a co-equal substrate. No further standards work.
2. **No `we:adapters.json` entry.** That catalog is for rendering/syntax/library adapters; base-select is a native-substrate impl, and the capability matrix already *is* its impl listing. Don't manufacture a standards surface for an implementation.
3. **The real deliverable is an eventual *implementation build*** — the base-select-backed droplist component: a WC wrapper that adopts `appearance: base-select`, plugs the droplist intents/traits onto it, and handles form-association / a11y / degradation (the same shape `frontierui/blocks/droplist/*` already is for the **FACE** impl; no base-select impl exists yet). This is a **build**, gated on base-select reaching a **second engine** — captured as **[#291](/backlog/291-base-select-backed-droplist-implementation/)** (`parked` until the precondition trips).

So: base-select makes sense (it's `native-ok` for more capabilities than `face`), it's already a sanctioned impl, and the work it implies is a deferred implementation, not a standard.
