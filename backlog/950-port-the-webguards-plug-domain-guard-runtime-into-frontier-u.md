---
type: decision
workItem: story
size: 3
parent: "170"
status: open
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
preparedDate: "2026-06-18"
relatedReport: reports/2026-06-18-webguards-reconciliation-grounding.md
tags: []
---

# Reconcile the webguards plug against FUI's already-restructured `blocks/guard` runtime (#875)

Originally framed as an additive FUI-side port; **attempted in batch-2026-06-18 and reverted** when the
port appeared to *collide* with the already-present `fui:blocks/guard` registry (two same-named classes,
different bases). Prepping it traced both repos and found the collision premise is **false** — the
standalone model and the `CustomRegistry`-extending plug are a **deliberate two-model pair that coexists
by design**, and the directly-sibling `webvalidation` port (landed today) already demonstrates the
faithful shape in FUI. So the A/B fork the revert raised dissolves to a single forced invariant: port
webguards exactly as the sibling was ported. Grounding trace in
[the report](../reports/2026-06-18-webguards-reconciliation-grounding.md).

## Grounding digest

WE ships **both** guard models intentionally, in separate modules with documented distinct roles:

- **Standalone block-level seam** — [we:guard/registry.ts:39](../guard/registry.ts#L39) `class
  CustomGuardRegistry` extends *nothing*; its header
  ([we:guard/registry.ts:33](../guard/registry.ts#L33)) says it *"Mirrors the `CustomRegistry` API the
  runtime plug extends … kept self-contained here"* — the dependency-free #288/#289 seam, usable
  unplugged (#606 floor).
- **Runtime plug** — [we:plugs/webguards/CustomGuardRegistry.ts:32](../plugs/webguards/CustomGuardRegistry.ts#L32)
  `class CustomGuardRegistry extends CustomRegistry<CustomGuardProvider>` — *"the **real plug** … so it
  participates in the injector chain … nearest-scope-wins (#207 D6) … reuses the provider contract … from
  the `guard/` model **verbatim** — only the registry base differs."* The plug *depends on* the standalone
  module (imports provider/guard from `we:guard/provider.js`, `UnknownGuardProviderError` from
  `we:guard/registry.js`); the barrel disambiguates by re-exporting the standalone as
  `StandaloneGuardRegistry` ([we:plugs/webguards/index.ts](../plugs/webguards/index.ts)).

They **do not collide** in WE (different files/export identities); the TS2416 worry that triggered the
revert is mis-diagnosed — the override compiles in WE *because* the plug extends `CustomRegistry`, and the
same override compiles in FUI for the siblings (next bullet).

FUI already holds the standalone half ([fui:blocks/guard/registry.ts:39](../../frontierui/blocks/guard/registry.ts#L39),
`UnknownGuardProviderError` :25; provider exports `NativeGuardProvider`/`assertGuardDecision`/`ALLOW` via
`@webeverything/contracts/guard`, landed by #875). The **plug half is settled by the sibling**: the other
#725 domain `webvalidation` was ported into FUI **today** and ships the #606 plug-family pattern verbatim —
[fui:plugs/webvalidation/CustomValidityMergeRegistry.ts:27](../../frontierui/plugs/webvalidation/CustomValidityMergeRegistry.ts#L27)
and [fui:plugs/webvalidation/CustomValidatorResolutionRegistry.ts:28](../../frontierui/plugs/webvalidation/CustomValidatorResolutionRegistry.ts#L28)
both `extends CustomRegistry<…>`, wired in `fui:plugs/bootstrap.ts:166,215`, blocks-level
subsystems left standalone, FUI build + vitest green. The sibling kept *both* models — exactly as WE does.

## The axis

The only question the revert actually raised is **what base the FUI webguards registry takes** — defer to
the standalone table (A), refactor the standalone to extend `CustomRegistry` (B), or replicate WE's pair
(keep the standalone, add a separate `CustomRegistry`-extending plug). Tracing the tree collapses it:
WE's own header on [we:guard/registry.ts:33](../guard/registry.ts#L33) and the just-landed `webvalidation`
sibling both show the pair is the intended shape, and each of A and B *breaks* one half of it. So this is a
**forced invariant**, not a weigh.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (rejected) | Confidence |
|------|---------------------|------------------------------|------------|
| 1 — registry base for the FUI webguards plug | **Replicate WE's two-model pair: keep `blocks/guard` standalone, add `plugs/webguards/CustomGuardRegistry extends CustomRegistry` verbatim (as the `webvalidation` sibling did)** | A (plug defers/re-exports only — no real plug) · B (collapse the standalone into the plug) | High |

## Fork 1 — what base does the FUI `webguards` registry take?

*Fork-existence justification (case (a), forced invariant):* **both** alternatives are flawed, so exactly
one branch is correct. **A** (defer-only re-export) yields no injector-chain participation — guards can't
be set per-scope nearest-scope-wins (#207 D6), making webguards the odd one out against the sibling
`webvalidation` that just shipped the opposite. **B** (refactor the standalone to extend `CustomRegistry`)
destroys the deliberate dependency-free unplugged seam (#606 floor; the #288/#289 block-level contract
must not depend on plug-core) that WE explicitly *"keeps self-contained"* and the sibling kept standalone.

**Crux refs:** WE pair = [we:guard/registry.ts:33,39](../guard/registry.ts#L33) (standalone, self-contained
by design) + [we:plugs/webguards/CustomGuardRegistry.ts:32](../plugs/webguards/CustomGuardRegistry.ts#L32)
(`extends CustomRegistry`, injector-chain). FUI standalone present:
[fui:blocks/guard/registry.ts:39](../../frontierui/blocks/guard/registry.ts#L39). Sibling precedent:
[fui:plugs/webvalidation/CustomValidityMergeRegistry.ts:27](../../frontierui/plugs/webvalidation/CustomValidityMergeRegistry.ts#L27).

**Recommended default — replicate WE's two-model pair (neither A nor B):** leave `fui:blocks/guard/`
untouched (it is the byte-twin of `we:guard/`, the unplugged seam); add
`fui:plugs/webguards/CustomGuardRegistry.ts extends CustomRegistry<CustomGuardProvider>` ported **verbatim**
from `we:plugs/webguards/CustomGuardRegistry.ts`, remapping the WE `../../guard/*` imports to
`../../blocks/guard/*` (provider/native/guard from `fui:blocks/guard/provider.js`, `UnknownGuardProviderError`
from `fui:blocks/guard/registry.js`); wire bootstrap (window global + `customGuards` injector +
`createDefaultGuardRegistry()` seed) mirroring `webvalidation` at `fui:plugs/bootstrap.ts:166,215`;
add a `fui:src/_data/plugs.json` `webguards` entry (note: the sibling `webvalidation` entry is
*also* still missing — cover both). This honours #875's standalone (untouched) **and** the #606 plug family,
because WE's source already proves the two are not in tension. Confidence **High** — it is the in-tree
arrangement WE ships plus a verbatim copy of a sibling that landed and is green today.

*Rejected branches:*
- **A — plug defers to the standalone (re-export only).** *Rejected:* not a real plug; no injector-chain /
  nearest-scope-wins (#207 D6); breaks parity with `customStores`/`customContexts`/the just-landed
  `webvalidation`.
- **B — collapse `blocks/guard` into a `CustomRegistry`-family plug.** *Rejected:* destroys the
  dependency-free unplugged seam (#606); reverses #875's deliberate self-contained standalone; the sibling
  port kept its blocks-level subsystems standalone, not collapsed.

## Per-fork classification

- **Which layer?** Implementation (plugs runtime → FUI per #606); WE keeps only the contract
  (`@webeverything/contracts/guard`, already consumed by FUI). No WE-side change.
- **Protocol or intent dimension?** Neither — a registry *base-class* choice, an impl detail of the plug
  runtime. Not a configurable axis exposed to authors.
- **Fixed mechanic or dimension?** Fixed mechanic — the two models are baked (standalone seam + injector
  plug), not a knob.
- **DI-injectable?** Yes — that is the *point* of the plug half: `CustomRegistry` participates in the
  injector chain (#207 D6); the standalone half deliberately does not (it just owns the table).
- **Separation/decouple bias:** satisfied by keeping both — the unplugged seam and the plug stay
  decoupled, the plug layered on top of (not merged into) the seam.

---

## Context — build once ratified

The ruling makes the residual a **mechanical #170-class port**, no design judgment, identical in shape to
the landed `webvalidation` port:

1. Add `fui:plugs/webguards/CustomGuardRegistry.ts` (verbatim from WE, import paths remapped) + a barrel
   `fui:plugs/webguards/index.ts` mirroring `we:plugs/webguards/index.ts`.
2. Bootstrap wiring in `fui:plugs/bootstrap.ts` (window global + `customGuards` injector +
   `createDefaultGuardRegistry()` seed), mirroring `webvalidation`.
3. `fui:src/_data/plugs.json` `webguards` catalog entry (and backfill the missing `webvalidation`
   entry while there).
4. Re-point the ported guard tests at `fui:plugs/webguards`; FUI build + vitest green.

**Relationships:** parent #170 (plugs-platform migration). Sibling `webvalidation` port = #725 (same
reconciliation, already landed — its registries are the precedent). WE-side deletion of the `plugs/` copies
stays **#449**'s job, gated by this port. No WE files change here.
