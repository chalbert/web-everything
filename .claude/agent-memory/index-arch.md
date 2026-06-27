---
name: index-arch
description: Where code lives across the WE→FrontierUI→Plateau constellation: WE holds zero impl, contract-vs-impl-vs-values carve, placement/consume-runtime tests, backward-edge import boundaries, contract.ts slicing, reusable→neutral home, plug definition, separation defaults, vendor-dep quarantine, repo constellation. Recall when deciding where something belongs, moving code between repos, or designing module/import boundaries.
metadata:
  type: reference
---

Constellation & Placement cluster — open a leaf with `node scripts/memory-resolve.mjs <N>` (or `--cat`):

- 6. WE Holds ZERO Standard Implementation — FOUNDATIONAL; impl→FUI; OK in WE: definitions + validate scripts; #1282
- 7. Project-Config Three-Layer Carve — contract→WE, impl→FUI, values→product; resolver=FUI; #1780/#1702
- 8. Theme Tokens Are JS-First — injector=SoT; CSS vars=one-way projection; can't read off-DOM/pre-attach; #1682
- 20. No-Consumer → Drop Backward-Compat — no live consumer ⇒ drop back-compat; migrate forward, delete old path
- 24. Contract TS Is A Separate Slice — `*/contract.ts`+`@webeverything/contracts/*` = own foundational slice; #1291
- 26. Conformance Verifier vs Subject — WE keeps only the CONTRACT; verifier→Plateau, subject→FUI; #1467
- 27. Scoped Registration OFF `<component>` — `<component>`=compile-time; scoped reg=runtime declared-registry+IDREF
- 28. FUI Vendor Deps → Sub-Package — react/vue in consuming sub-package's package.json; never root, never shipped
- 29. Cross-Origin Import Keeps Dev Clean — serve framework wrappers from a 2nd origin via x-origin import; #1499
- 30. Backward Edge = Module Import Only — DAG bans upstream CODE imports; runtime boundary (x-origin/CLI) ≠ edge
- 31. Placement: Does FUI Consume Runtime? — contract.ts: types→WE, runtime→FUI unless check.ts over WE data; #1566
- 32. Contract Distribution End-State — #700 = WE→FUI only; FUI→WE via type-only contracts pkg; #872
- 33. Block-Explorer: Chrome ≠ Distribution — workbench=FUI-OWNED product, not WE chrome; via `locus:`
- 74. Runtime DI vs Devtools Provider — CustomXRegistry=runtime-DI only if running standard consults it; else provider
- 87. Bias Toward Separation — combine-vs-split ⇒ default two composable homes; burden on combining
- 88. File-Count ≠ Schema-Coupling — separation=schema/ownership, not file count; #1662
- 94. Managed-Offering Constellation Layering — standard→WE, primitives→FUI, product→plateau
- 95. Plug = Proposed Missing Standard — plugged=proposed standard; unplugged=safe-now; #1826/#1807
- 96. Repo Constellation — WE (standard+plugs)→Frontier UI (impl)→plateau-app (product); legacy `plateau` ABANDONED
- 97. Reusable Home Rule — reusable→plateau; impl-specific→its impl; #1788
