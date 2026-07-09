---
kind: decision
parent: "1294"
status: open
priority: low
dateOpened: "2026-07-06"
preparedDate: "2026-07-09"
relatedReport: reports/2026-07-09-webtraits-webcases-placement-cascade.md
tags: [constellation-placement, relocation, webtraits, conformance, decision]
---

# webtraits surface resolver — definition (stays WE) or impl (relocates to FUI)?

## Context

`we:webtraits/surfaceIntentResolver.ts` was resolved WE-resident "definition" by #1911, but it maps a `surface`
profile (texture/interaction/elevation/variant) to CSS: `resolveSurface()` returns structured declarations and
`surfaceCss()` wraps them into a selector-scoped ruleset string — the same shape as webtheme's `compileToCss`,
which the #1294 cascade relocated to FUI. Ratifying a relocation unblocks a mechanical 5-slice cascade. Parked;
blocks nothing live.

> **Prep note (2026-07-09, `/prepare all`).** A statute survey now grounds this card — published as research
> topic [`webtraits-webcases-placement-cascade`](/research/webtraits-webcases-placement-cascade/) (report
> [we:reports/2026-07-09-webtraits-webcases-placement-cascade.md](../reports/2026-07-09-webtraits-webcases-placement-cascade.md)).
> The survey **reshaped the fork**: the original framing ("relocate `surfaceCss` the string emitter, keep the
> resolver") cuts at the wrong seam. The webtheme precedent relocated the *whole* mapping runtime — **both**
> `resolveTokens` and `compileToCss` (`fui:webtheme/tokens.ts`, `fui:webtheme/compile.ts`; WE's
> `we:webtheme/contract.ts` is types-only) — and `resolveSurface()` bakes in **native-default strategies**,
> which `{#constellation-placement}:86` routes to FUI explicitly. So the surviving default is **relocate the
> whole surface mapping runtime**, which *corrects #1911's over-hold* (a skeptic-refuted the surfaceCss-only
> split).

## Grounding digest

- **`resolveSurface()` emits native-default strategies, not just a value map.** The elevation→box-shadow ramp
  (`we:webtraits/surfaceIntentResolver.ts:71`), the `blur(12px)` glass fallback
  (`we:webtraits/surfaceIntentResolver.ts:98`), and the `translateY(-2px)` / `0.2s ease` lift ramp
  (`we:webtraits/surfaceIntentResolver.ts:119-123`) are concrete presentational defaults.
  `{#constellation-placement}` (`we:docs/agent/platform-decisions.md:84-89`) routes *"a running handler — incl.
  … **native-default strategies**"* → **Frontier UI**, and holds **WE zero-implementation, not even a reference
  implementation.**
- **The webtheme precedent relocated the whole runtime, not the string alone.** FUI holds **both** the value-map
  producer `resolveTokens` (`fui:webtheme/tokens.ts`) and the string emitter `compileToCss`
  (`fui:webtheme/compile.ts`); WE keeps `we:webtheme/contract.ts` = **types only** (verified: no exported
  functions). Purity did not keep `resolveTokens` in WE — so it cannot keep `resolveSurface` either.
- **#1911's parity justification is false.** #1911 kept the module on the claim it is "the same shape as
  `intentProfileResolver` / `requirementValidator`." But `we:webtraits/intentProfileResolver.ts` returns
  trait-bundle *metadata / plans* (`ResolvedTrait[]` / `BundlePlan`) and emits **no CSS**; `resolveSurface`
  emits CSS declarations with baked native-default values. Its true twin is webtheme (FUI), not the metadata
  resolvers. #1911 over-held on the purity test that #1282 withdrew.
- **#1816 does not authorize "map stays WE."** #1816 (`we:docs/agent/platform-decisions.md:421`) pins the
  webtheme *conformance subject* to the `resolveTokens` map, not the `compileToCss` string — a *what-a-binding-
  observes* rule. In webtheme **both** producers live in FUI, so #1816 cannot be cited to keep any producer in
  WE. (Do not lean on it — citation-scope trap.)

## Axis-framing

The live axis is **where the executable surface value→CSS mapping lives** — a constellation-placement call, not
an FUI impl detail: relocation changes WE's published export surface (today WE exports `resolveSurface` /
`declarationsToCss` / `surfaceCss`; after, WE exports only the profile/declaration **types**). Running the
fork-existence test: this is a **real fork** because the two coherent readings genuinely cannot coexist — the
executable map lives in WE **or** in FUI, one home wins — and the *flawed* branch (keep it in WE per #1911) is
broken by `{#constellation-placement}:86` (native-default strategies → FUI) + memory rule #6 (WE holds zero
implementation). Which layer: **relocation to FUI**, with WE keeping the **contract** (the `surface` intent
`we:src/_data/intents/surface.json` + the profile/declaration types + a to-author surface vector corpus). The
fork turns on a **code-level shape** (which symbols WE exports vs FUI imports), so it carries a concrete code
example.

## Recommended path at a glance

| Fork | Question | Recommended default (post-skeptic) | Main alternative (excluded) |
| --- | --- | --- | --- |
| 1 | Where does the executable surface value→CSS mapping live? | **(c) Relocate the whole mapping runtime (`resolveSurface` + `elevationShadow` + `declarationsToCss` + `surfaceCss`) to FUI beside webtheme; WE keeps the profile/declaration types + the `surface` intent + a to-author vector corpus.** Webtheme parity; corrects #1911's over-hold. | **(a) Keep the whole module in WE** (#1911 status quo — broken by the native-default-strategies clause) · **(b) Relocate only `surfaceCss` the string emitter** (cuts at the wrong seam; leaves the native-default strategies in WE) |

## Fork 1 — Where the executable surface value→CSS mapping lives

**Fork exists because** the *flawed* branch is real and broken: keeping `resolveSurface` in WE (options (a)/(b))
leaves WE hosting the elevation-shadow ramp, the glass-blur fallback, and the lift ramp — concrete
**native-default strategies** that `{#constellation-placement}:86` routes to FUI and that memory rule #6
forbids WE from holding ("WE holds zero implementation"). And the two coherent homes genuinely cannot coexist —
a consumer imports `resolveSurface` from `@webeverything` **or** from FUI, not both; one repo owns the executable
map.

- **(c) Relocate the whole surface mapping runtime to FUI (default).** `resolveSurface` + `elevationShadow` +
  `declarationsToCss` + `surfaceCss` move to FUI beside webtheme. WE keeps the **contract**: the
  `SurfaceProfile` / `SurfaceTexture|Interaction|Elevation|Variant` / `CssDeclaration` / `ResolvedSurface`
  **types**, the `surface` intent (`we:src/_data/intents/surface.json`), and a **to-author surface
  conformance-vector corpus** (the webtheme `we:conformance-vectors/webtheme.vectors.ts` archetype — profile →
  expected declarations, deep-equal per #1816). FUI imports the WE types; nothing in WE imports back (no WE→FUI
  edge). This is **verbatim webtheme parity** and **corrects #1911's over-hold** — a reconciliation, not a
  collision: #1911's ruling that the `surface` *intent* is WE-owned stands; only the mis-kept executable map
  moves. Cost: the one consumer (the hovercard preset assembly, `we:src/_data/assemblerPresets/hovercard.json`
  via the FUI recipe engine) resolves surface CSS through FUI — which is already where the recipe engine lives.
- **(b) Relocate only `surfaceCss` the string emitter (dominated).** The item's original framing and the
  session's first-draft default. Splits at the brace-wrapping seam: `surfaceCss` + `declarationsToCss` → FUI,
  `resolveSurface` stays WE. **Dominated** — it leaves the native-default *strategies* (the shadow ramp, blur,
  lift values inside `resolveSurface`) in WE, which is exactly what `:86` sends to FUI. Cutting only the text
  wrapper is cosmetic; the delivery decisions are in the map, not the string.
- **(a) Keep the whole module in WE (rejected — #1911 status quo).** Rest on #1911's "pure resolver =
  definition." **Broken:** purity is not the WE/FUI test (`resolveTokens` is pure and lives in FUI), the parity
  claim underpinning #1911 is false (`intentProfileResolver` emits no CSS), and the native-default-strategies
  clause is dispositive. Keeping it re-commits the #1078/#1282-withdrawn reference-runtime shape in WE.

Symbol split under the default (keyed to the real module — which symbols WE exports vs FUI owns):

```ts
// WE keeps the CONTRACT only — we:webtraits/surfaceContract.ts (types + a to-author vector corpus):
export type SurfaceTexture = 'solid' | 'glass' | 'transparent';
export type SurfaceInteraction = 'static' | 'lift' | 'scale';
export interface SurfaceProfile { texture?: SurfaceTexture; interaction?: SurfaceInteraction; /* … */ }
export interface CssDeclaration { property: string; value: string; }
export interface ResolvedSurface { base: CssDeclaration[]; hover: CssDeclaration[]; animated: boolean; }
// + we:conformance-vectors/surface.vectors.ts  — profile → expected declarations (deep-equal, #1816 archetype)

// FUI owns the RUNTIME — fui:webtheme/surface.ts (beside compileToCss), importing the WE types:
import type { SurfaceProfile, ResolvedSurface } from '@webeverything/webtraits/surfaceContract';
export function resolveSurface(profile: SurfaceProfile = {}): ResolvedSurface { /* elevationShadow ramp,
  blur(12px), translateY lift — the native-default strategies {#constellation-placement}:86 routes here */ }
export function surfaceCss(selector: string, profile: SurfaceProfile = {}): string { /* selector-scoped emit */ }

// (b dominated) — the wrong seam: surfaceCss → FUI but resolveSurface (with the ramps) stays WE, re-committing
// native-default strategies to WE against :86.
```

**Skeptic:** REFUTED-then-corrected (hostile refutation, all four axes). The **surfaceCss-only split (b) was
REFUTED**: cutting the string wrapper leaves the native-default strategies (`elevationShadow`, `blur(12px)`,
`translateY` — `we:webtraits/surfaceIntentResolver.ts:71,98,119`) in WE, which `{#constellation-placement}:86`
sends to FUI. **(0) Classification:** genuine one-home-wins placement fork, not support-both (a consumer imports
the map from one repo). **(1) Merit:** the webtheme precedent cuts *toward* relocation — FUI holds `resolveTokens`
*and* `compileToCss`, so "pure map stays WE" has no precedent; the #1911 parity claim is false
(`intentProfileResolver` emits no CSS). **(2) Statute-overlap:** `codifiedIn` would extend
`{#constellation-placement}` with "a value→CSS map carrying native-default values is delivery runtime → FUI";
this **reconciles with #1911** (its `surface`-intent-is-WE ruling stands; the executable map was mis-kept) — no
collision, an amendment recorded on resolve. **(3) Citation-scope:** #1816 is **not** cited as authority (its
scope is conformance-observation, not placement) — the default rests on `:84-89` + the webtheme end-state.
**Screen:** clear (fresh-context two-confusion). (1) Contract-visible — WE's export surface changes
(`resolveSurface`/`surfaceCss` leave `@webeverything`; only the types remain). (2) Merit remains free-of-cost —
the zero-impl boundary over the concrete CSS-value strategies is a real architectural call, not prioritization.

## Downstream

Ratifying (c) starts the mechanical 5-slice relocation cascade: (1) author `we:webtraits/surfaceContract.ts`
(types) + `we:conformance-vectors/surface.vectors.ts`; (2) move `resolveSurface` + helpers + `surfaceCss` to
`fui:webtheme/surface.ts` importing the WE types; (3) repoint the hovercard preset assembly through the FUI
recipe engine; (4) delete the WE runtime, leaving prose references; (5) amend `{#constellation-placement}` +
record the #1911 reconciliation in `we:docs/agent/platform-decisions.md`. File as #1294-child slices once
ratified.

---

Cluster 1 of the #1294 relocation epic; sibling of #2299 / #2300. Prep research:
[we:reports/2026-07-09-webtraits-webcases-placement-cascade.md](../reports/2026-07-09-webtraits-webcases-placement-cascade.md);
research topic [`webtraits-webcases-placement-cascade`](/research/webtraits-webcases-placement-cascade/).
