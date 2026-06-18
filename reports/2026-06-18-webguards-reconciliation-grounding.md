# Grounding: how the `webguards` plug relates to FUI's `blocks/guard` — #950

**Date:** 2026-06-18 · **For:** backlog #950 (decision, parent #170) · **Type:** ratify-shipped-code (no
greenfield — web-standards survey N/A; grounding is the concrete-refs trace below)

## TL;DR

The #950 fork ("**A** plug defers to the standalone `blocks/guard` registry **vs B** refactor that
registry to extend `CustomRegistry`") rests on a **false premise** — that the standalone model and a
`CustomRegistry`-extending plug *collide* and one must win. Tracing both repos shows they are a
**deliberate, documented two-model pair that coexists by design**, and the directly-sibling
`webvalidation` port (#725, landed 2026-06-18) already demonstrates the faithful shape in FUI. So there
is no A/B choice: the port **replicates WE's dual-model verbatim** — keep `blocks/guard/` standalone,
add `plugs/webguards/CustomGuardRegistry extends CustomRegistry`. Both A and B are *flawed* branches
(forced invariant, case (a)).

## The two models are intentional, not a collision

WE ships **both** today, in different modules with distinct, documented roles:

- **Standalone model — `we:guard/registry.ts:39`** `export class CustomGuardRegistry` extends *nothing*.
  Header `we:guard/registry.ts:33`: *"Mirrors the `CustomRegistry` API the runtime plug extends … kept
  self-contained here … nearest-scope-wins is the runtime plug's job; this standalone model just owns
  the table."* It is the dependency-free **block-level seam** (#288/#289), usable with zero plug-core
  dependency — the #606 *"every plug must be usable unplugged"* floor. `we:guard/index.ts` builds it via
  `createDefaultRegistry()` pre-loaded with the native-first provider.
- **Runtime plug — `we:plugs/webguards/CustomGuardRegistry.ts:32`** `export default class
  CustomGuardRegistry extends CustomRegistry<CustomGuardProvider>`. Header: *"the **real plug** … so it
  participates in the injector chain — a scope sets one on its injector and regions below resolve it
  nearest-scope-wins (#207 D6) … It reuses the provider contract, the native default, and the decision
  guard from the `guard/` model **verbatim** — only the registry base differs … so the trust-boundary
  policy has one home and cannot drift."* Adds `resolve(key?)` + `evaluateRegion(...)` on top of the
  inherited `set()`/`get()`.

They **do not collide** in WE: different files, different export identities. The plug's own barrel
disambiguates — `we:plugs/webguards/index.ts` re-exports the plug as `CustomGuardRegistry` and the
standalone as `StandaloneGuardRegistry` (+ `UnknownGuardProviderError`). The plug *depends on* the
standalone module for the contract/provider/guard (imports from `we:guard/provider.js` and
`UnknownGuardProviderError` from `we:guard/registry.js`) — they are layered, not rival.

The #950 item's TS2416 "same-named class, incompatible `define` override" worry is therefore mis-framed:
the override `define(provider, asDefault?)` over base `define(name, …args)` compiles in WE precisely
*because* the plug extends `CustomRegistry` — and the same override compiles in FUI for the siblings
(below). The claim "compiles in WE only because WE has no standalone twin" is wrong: **WE has the
standalone twin** (`we:guard/registry.ts`) and both compile.

## FUI already has the standalone half; the sibling proves the plug half

- **Standalone half — already in FUI.** `fui:blocks/guard/registry.ts:39` `class CustomGuardRegistry`
  (standalone) + `:25 UnknownGuardProviderError`; `fui:blocks/guard/provider.ts` exports
  `NativeGuardProvider:78`, `assertGuardDecision:54`, `ALLOW:69`, `GuardDecisionError:41`, contract via
  `@webeverything/contracts/guard` (landed by #875). This is the byte-twin of `we:guard/`.
- **Plug half — the sibling shows the exact shape.** `webvalidation` (the other domain under #725, same
  parent #170, same reconciliation) was ported into FUI **today** and ships the #606 plug-family pattern
  verbatim: `fui:plugs/webvalidation/CustomValidityMergeRegistry.ts:27 extends
  CustomRegistry<CustomValidityMergeStrategy>` and `fui:plugs/webvalidation/CustomValidatorResolutionRegistry.ts:28 extends
  CustomRegistry<CustomValidatorResolution>`. Bootstrap wires them as window-globals +
  `createDefault…Registry()` (`fui:plugs/bootstrap.ts:166,215`). Its blocks-level subsystems stayed
  standalone — i.e. the sibling kept *both* models, exactly as WE does. FUI build + vitest are green for
  it (#725/#875).

Other FUI plug domains confirm the family: `webstates`/`webcontexts`/`webbehaviors` registries extend
`HTMLRegistry → CustomRegistry` (constructor domains); guard/validation register *provider objects*, so
they extend `CustomRegistry` directly — same base, the level at which "plug family" is defined.

## What each branch would cost (why both A and B are flawed)

- **A (defer-only re-export).** The plug would *not* be a real plug — re-exporting the standalone table
  gives no injector-chain participation, so guards can't be set per-scope nearest-scope-wins (#207 D6).
  It would make webguards the **odd one out** against the sibling `webvalidation` that just shipped the
  opposite, and against `customStores`/`customContexts`. Flawed.
- **B (collapse the standalone into the plug).** Refactoring `blocks/guard/` to extend `CustomRegistry`
  destroys the deliberate **dependency-free unplugged model** — the block-level #288/#289 seam that must
  not depend on plug-core (#606 unplugged floor). WE explicitly ships both and says the standalone is
  *"kept self-contained here"*; the sibling kept both. Flawed.
- **Correct (neither).** Replicate WE's pair: leave `fui:blocks/guard/` standalone, add
  `fui:plugs/webguards/CustomGuardRegistry extends CustomRegistry<CustomGuardProvider>` ported verbatim
  from `we:plugs/webguards/`, importing provider/guard from `fui:blocks/guard/provider.js` and
  `UnknownGuardProviderError` from `fui:blocks/guard/registry.js` (the WE `../../guard/*` paths remap to
  `../../blocks/guard/*` in FUI), + bootstrap wiring + a `fui:src/_data/plugs.json` `webguards` entry.

## Consequence

The decision is a **forced invariant** (case (a)): one correct end-state, two flawed alternatives. Once
ratified, the residual work is a **mechanical #170-class port** with no design judgment — identical in
shape to the just-landed `webvalidation` port — so it can graduate straight to a small build slice under
#170 (no further reconciliation). Sibling note: `fui:src/_data/plugs.json` has **no** `webvalidation` entry yet either
(grep), so the catalog entry is a known small gap to cover for both. WE-side deletion of the `plugs/`
copies stays #449's job (gated by the port).
