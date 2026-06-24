---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: "fui:blocks/renderers/functional/functionalComponent.ts"
tags: []
---

# Relocate the functional-component renderer out of WE per #1282 (impl→FUI)

The functional renderer impl lives WE-resident at we:blocks/renderers/functional/functionalComponent.ts (generateFunctionalSource — the functional twin of the declarative component lowering). #1282 (resolved) withdrew WE's reference-impl tier (WE = contract/vectors only), so this runtime belongs in FUI. Build the FUI functional renderer importing the FUI component kernel (#1767), relocate functionalComponent.test, and KEEP in WE only the contract + conformance vectors. Prereq for deleting the shared component kernel (#1775) — functionalComponent.test value-imports parseDefinition. Builds on the #1619/#1746 functional-adapter decisions (resolved). FUI has no functional renderer today; nothing kept WE-resident imports it, so no #1771-style WE→FUI seam.

## Progress (2026-06-24) — FUI twin built + test relocated; WE-impl delete folded into #1730

Ground the consuming tree before moving (the card's "nothing kept WE-resident imports it" is true only
for code that *stays*): `we:blocks/renderers/module-service/moduleService.ts:21` still value-imports
`generateFunctionalSource` for the `'functional'` ServeForm, and moduleService is WE-resident until
**#1730** relocates it. So the WE impl couldn't be deleted now without breaking moduleService — deleting
it is folded into #1730 (noted there), which removes the last consumer. The functional family's
*independent* kernel-pin (the test value-importing `parseDefinition`) **is** removed here, so this clears
#1778 as a #1775 blocker; moduleService's own direct kernel import remains the #1730 pin.

Delivered (non-breaking, forward progress #1730 + #1775 both need):
- **Built** `fui:blocks/renderers/functional/functionalComponent.ts` — port of the WE impl, importing the
  FUI component kernel (`pascal`/`ComponentDef`, #1767) and `htmlToJsx` from `@frontierui/component-compiler`
  (the canonical HTML⇄JSX mirror dialect; the in-repo `jsx` copy was deleted FUI-side per #265).
- **Exported** it from `fui:blocks/renderers/index.ts`.
- **Relocated** the test → `fui:blocks/__tests__/unit/renderers/functionalComponent.test.ts` (htmlToJsx now
  sourced from the package); **deleted** the WE copy. FUI suite green (5/5); WE renderer suite green (532).
- **Kept** WE-resident: `we:blocks/renderers/functional/functionalComponent.ts` (impl, consumed by
  moduleService → deletes in #1730) + the component-family contract/vectors (`component-cases`, /adapters/).
