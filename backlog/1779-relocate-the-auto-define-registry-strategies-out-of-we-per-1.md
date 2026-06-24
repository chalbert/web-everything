---
kind: story
size: 5
status: open
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
relatedTo: ["1775", "1767", "1702", "1662", "1282"]
locus: frontierui
tags: [frontierui, blocks, renderers, relocation]
---

# Relocate the auto-define registry + strategies out of WE per #1282 (impl→FUI)

The full auto-define impl lives WE-resident at we:blocks/renderers/auto-define/ — CustomAutoDefineRegistry
+ buildParsedStrategy + lazyDomStrategy + explicitAutoDefine (the #227/#241/#242 strategy axis). #1767
ported only the minimal defineElement leaf to FUI; the registry + strategies remain WE-side. #1282
(resolved) withdrew WE's reference-impl tier (WE = contract/vectors only), so this runtime belongs in
FUI. Relocate the registry + strategies + `autoDefine.test` to FUI, KEEP in WE only the contract +
conformance vectors. Prereq for deleting the shared component kernel (#1775).

## Pre-flight (claimed 2026-06-24) — premise was false; resolved via the config-impl carve (#1780); released

The card's closing claim — *"nothing kept WE-resident imports the registry, so no #1771-style WE→FUI
seam"* — is **wrong**. `we:config/` (the #1702 webeverything.config surface) imports the registry:
`we:config/platformFlavor.ts` (VALUE — `new CustomAutoDefineRegistry({ extends })`),
`we:config/defineConfig.ts` (`import type AutoDefineFlavorName`), `we:config/__tests__/config-resolve.test.ts`
(real-registry tests). Relocating the registry to FUI while that consumer stays WE-resident creates the
banned **WE→FUI backward edge**.

**Resolution (discussion 2026-06-24): the consumer is the real problem, not the registry.**
`we:config/`'s resolver (`resolveDimension`/`resolveConfig` runtime + `we:config/platformFlavor.ts`
factory wiring) is itself **runtime impl mis-homed in WE** — #1702 placed it there; #1282 says impl→FUI.
It carves three ways — **contract→WE** (the `DimensionResolver` interface, `WebEverythingConfig` schema,
`defineConfig` author surface, native-first default declarations, vectors), **resolver impl→FUI** (the
impl *of* that contract), **project config values→product layer** — tracked as **#1780**. Once #1780
relocates the config resolver impl to FUI, **no WE-resident consumer of the registry remains**.

So no genuine fork survives (registry→FUI is forced by #1282; the earlier WE-vs-plugs/blocks placement
question dissolved once the consumer leaves WE), and this reverts from the decision card it briefly became
to a plain relocation build:

- `CustomAutoDefineRegistry` + `AUTO_DEFINE_FLAVORS` + `lazyDomStrategy` + `buildParsedStrategy` →
  `fui:blocks/renderers/auto-define/` (next to #1767's `defineElement` — its natural home).
- `autoDefine.test` → FUI.
- WE keeps only the auto-define **contract** (`defineElement`/`explicitAutoDefine` + the `AutoDefineStrategy`
  interface) + conformance vectors.

**Ordering:** #1780 must land **before** this relocation. FUI→WE is forward (legal), so after #1780 the
FUI-resident config impl can import the still-WE registry in the interim; but if the registry moved
*first* while config impl were still WE-resident, that WE→FUI edge would be stranded. Hence `blockedBy:
[1780]`. Released `active → open` pending #1780.

## Post-#1780 state (2026-06-24) — interim wiring this relocation must clean up

#1780 landed. The config resolver impl now lives at `fui:config/` (`fui:config/resolveDimension.ts`
runtime + `fui:config/platformFlavor.ts` factories + `fui:config/index.ts` +
`fui:config/__tests__/config-resolve.test.ts`); WE keeps only the contract barrel `we:config/`
(`we:config/defineConfig.ts` schema/guards/author-surface, `we:config/resolverContract.ts`
`DimensionResolver`, `we:config/platformDefaults.ts` declarations), published to FUI as
`@webeverything/config`. WE no longer consumes the registry (`we:config/defineConfig.ts` now types
`AutoDefineFlavorName = string`).

`fui:config/platformFlavor.ts` imports the still-WE registry via a **relative sibling path**
(`we:blocks/renderers/auto-define/CustomAutoDefineRegistry`), and because that registry imports
`@frontierui/plugs/*`, #1780 added a **transient self-alias** `@frontierui/plugs → fui:plugs/` to
`fui:tsconfig.json` + `fui:vite.config.mts` + `fui:vitest.config.ts`. When this card relocates the registry
into `fui:blocks/renderers/auto-define/`, **rewrite that import to a FUI-local path (`@core`/relative) and
delete the transient `@frontierui/plugs` alias from the three FUI configs** — it exists only to resolve the
cross-tree hop while the registry is still WE-resident.
