---
type: decision
workItem: story
size: 3
status: open
preparedDate: "2026-06-18"
relatedReport: reports/2026-06-18-905-trait-enforcer-relocation-surgery.md
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
tags: [constellation, trait-enforcer, frontierui, standard-impl-boundary]
---

# Decide exactly what of WE's trait-enforcer moves to FUI vs stays, given WE consumers + partial FUI copy (#894 surgery)

**Placement-of-shipped-code decision** that surgically scopes the #779 ratified "whole `tools/trait-enforcer/`
→ FUI" against the real import closure. Blocks **#894** (the relocation). Reconsiders part of **#779**.

## Grounding digest (verified against the tree 2026-06-18)

#894's pre-flight found #779's premises only partly true:

- **FUI does NOT already hold the whole enforcer.** `../frontierui/tools/trait-enforcer/` has only
  `we:vite-plugin.ts` + `fui:virtual.d.ts` — **not** `we:traitManifestContract.ts`, the rollup/webpack/esbuild/parcel
  plugins, or `we:composedTraitSet.ts`. A move must **ADD** those to FUI, not delete a duplicate.
- **WE genuinely consumes a piece marked for removal.** `we:blocks/renderers/module-service/traitServePath.ts:28-31`
  imports `TraitManifest`/`TraitManifestEntry` **types** from `traitManifestContract` — the MaaS serve-path
  (#461/#505). WE may not import FUI (#239 npm-scope-mirrors-layer), so moving the contract out breaks it.
- **The contract is authored as a *neutral* SoT, not an FUI IR.** `we:tools/trait-enforcer/traitManifestContract.ts:1-30`:
  "the **neutral, bundler-agnostic** trait-manifest contract … the trait-side analogue of the MaaS serve-path
  IR (`we:servePathIR.ts`, #505)" — pure data + types, **no imports**, scan grammar shipped as regex-source so a
  **.NET/Java/Go** generator can read it (#463 polyglot reach). It explicitly distinguishes itself (the
  *definition*) from `we:vite-plugin.ts`'s `generateManifestModule` (the *reference impl* / emitted IR).
- **The protocol surface is already separate** — `trait` attr + `registerTraits` + `CustomAttributeRegistry`
  live in `plugs/webbehaviors/`, **not** in `tools/trait-enforcer/`. `CustomAttributeRegistry` is foundational:
  consumed by `blocks/{navigation,router,for-each}`, `on-event`, `plugs/{index,unplugged,bootstrap}`, injectors.

See **[the prep report](../reports/2026-06-18-905-trait-enforcer-relocation-surgery.md)** for the full import
closure, classification, and red-team notes.

## Axis-framing

The constellation axis (#463/#817/#855/#507/#239): **code that *defines* a neutral contract → WE; code that
*implements/generates against* it → FUI; a runtime symbol stays WE only if a WE-side consumer/gate uses it; WE
may never import FUI.** Run over the trait-enforcer's import closure, that axis sorts five artifacts cleanly —
three are settled (no fork), two are genuine either/or calls because #779's whole-tree ruling collides with a
WE-side consumer (`traitServePath`) and a foundational WE plug (`CustomAttributeRegistry`).

## Supported by default (settled — no fork)

- **5 bundler plugins** (`we:vite/rollup/webpack/esbuild/parcel-plugin.ts`) **→ FUI.** Runnable scan-and-emit
  codegen, no WE-side consumer (WE's traitMap is empty by design). #779 holds; obviously impl.
- **`we:composedTraitSet.ts` → FUI.** Runnable authoring construct, consumed only by its own test. Imports
  `TraitMap` *type* from the contract = FUI→WE (the allowed direction, #700/#872), so it moves cleanly.
- **`vite.config.mts:96` swap → mechanical.** Drop `traitEnforcer({traitMap:{}})`; copy the **vitest leg's**
  existing `resolve.alias` `'virtual:trait-manifest' → '/plugs/webbehaviors/traitManifest'`
  (`we:vitest.config.ts:71-75`) into `vite.config.mts`. `we:bootstrap.ts:62` resolves, manifest stays empty —
  byte-identical runtime. Not a fork; falls out of whichever way Fork 1 lands.

## Recommended path at a glance

| Fork | Question | Excluded branch (why it's a fork) | **Default** | Conf. |
|---|---|---|---|---|
| 1 | Does `we:traitManifestContract.ts` move to FUI or stay WE? | Move-to-FUI forces WE's `traitServePath` into a forbidden WE→FUI import (#239) | **Stay WE (option A)** | ~75% |
| 2 | Does the `plugs/webbehaviors/` protocol surface move to FUI or stay WE? | Wholesale move guts a foundational WE binding plug used across nav/router/for-each | **Stay WE** | ~75% |

Both defaults = the item's original **option A**. **B** = Fork 1 → move. **C** = Fork 2 → move.

## Fork 1 — locus of `we:traitManifestContract.ts`

*Fork exists because:* the two branches genuinely cannot coexist — `we:traitServePath.ts` (a WE file, the MaaS
serve-path) imports the contract's types, and WE may not import FUI (#239), so the contract is either WE's
(traitServePath keeps consuming it; FUI imports it FUI→WE) **or** FUI's (traitServePath must be re-homed). One
file, two layers — a real either/or, and it reverses part of #779.

- **A — keep it in WE (default, ~75%).** The file is authored to the *same* neutrality discipline as the
  WE-owned `servePathIR` (#505), ships polyglot regex-source for #463 reach, and has a live WE consumer
  (`traitServePath`). The placement test (#817) puts a contract with a WE-side consumer in WE. FUI's bundler
  plugins + `composedTraitSet` import it FUI→WE — the ratified end-state direction (#700/#872). *Reverses #779's
  "the whole enforcer incl. the contract → FUI."* **Red-team at decision:** #779's user-affirmed read was that
  the manifest format is "tied to how FUI does things." The counter is that #779 conflated the **contract**
  (neutral types + scan grammar — this file) with the **emitter** (`generateManifestModule` — FUI code). If the
  decider still reads the format itself as FUI-shaped after that distinction, fall to B.
- **B — move it to FUI + re-home/rewire `traitServePath`.** Honours #779 literally and keeps the enforcer
  whole. Cost: re-homes the MaaS serve-path planner (a WE #461/#505 distribution concern) to FUI, or splits
  `traitServePath` so its contract-dependent half lives FUI-side — couples a WE distribution seam to FUI's
  locus and forks `servePathIR`'s WE-owned IR family. Only correct if the format is genuinely FUI-shaped.

## Fork 2 — locus of the Web Traits protocol surface (the #779 ~70%/~30% residual)

*Fork exists because:* #779 explicitly left open (~70% stays) whether WE's Web Traits standard reduces to the
generic `CustomAttributeRegistry` plug — a real either/or about whether a WE *standard* exists here at all.
The two end-states (Web Traits is a WE standard / Web Traits is wholly FUI's) cannot coexist.

- **Stay WE (default, ~75%).** `CustomAttributeRegistry` is a runtime-DI standard seam (#052/#081) consulted by
  the running app and foundational across `blocks/{navigation,router,for-each}` + injectors — it cannot move
  without gutting WE's binding layer. Native-first makes the `trait` attribute + `registerTraits` semantics the
  Web Traits standard's surface. Bias-to-separation does **not** argue to move: the surface is *already*
  decoupled from the enforcer (`plugs/webbehaviors/` ≠ `tools/trait-enforcer/`); moving it would *fold* a
  foundational plug into FUI — the opposite of decoupling.
- **Move to FUI (the ~30% branch).** Reads WE's Web Traits as too thin to be a standard (empty manifest + a
  bootstrap helper). Even this branch keeps `CustomAttributeRegistry` in WE — so the move is at most
  `registerTraits` + the runtime `traitManifest` type, a marginal relocation that strips the `trait`-attribute
  vocabulary from the WE standard set. *The residual the decider should weigh:* whether "Web Traits" earns
  standard status or is just a usage pattern over the generic registry plug.
