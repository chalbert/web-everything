---
type: issue
workItem: story
size: 3
parent: "715"
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: blocks/renderers/module-service/definitionRegistry.ts
tags: []
---

# Union trait modules into the MaaS definition resolver (serve trait chunk bytes)

Item #719 landed the neutral trait served-path (`we:traitServePath.ts`) + distribution plan that maps a #716 manifest onto the existing #461 origin route, but the MaaS `DefinitionResolver` only resolves component `<name>` artifacts, so a fetch to `/_maas/<trait>.js` still 404s. Extend the resolver (`we:tools/maas/vite-plugin.ts` indexDefinitions / `we:definitionRegistry.ts`) to union trait module definitions so trait chunk bytes are actually served. Build seam only — no design fork.

## Resolved (2026-06-16)

Three small, fork-free pieces (the only design call — how a non-`<component>` source serves — has one
coherent answer, so it's a fixed mechanic, not a fork):

- **`we:definitionRegistry.ts`** — `indexTraitModules(modules)` builds a `name → pre-built module source`
  registry (the trait-side resolver). A trait carries no `<component name=>`, so its name is supplied
  explicitly rather than scanned.
- **`we:tools/maas/vite-plugin.ts`** — the trait registry is unioned in as the component resolver's
  `fallback`, so one `resolve()` answers for both: a component name locally, a trait name via the
  fallback. `traitModules` is empty today (WE authors no traits yet — `traitEnforcer({ traitMap: {} })`);
  the seam is wired ahead of the first authored trait (#359/#736) so a `/_maas/<trait>.js` fetch resolves
  the moment one lands, no further origin change.
- **`we:moduleService.ts`** — `serve()` now routes a resolved source that is **not** a `<component>`
  definition (`isComponentDefinition`) to verbatim passthrough as a JS module: a trait chunk is already
  the final artifact, so the `form` param is moot (a module has one served shape). The framework-agnostic
  #461 `fetchHandler` is unchanged — the wire shape (`<name>[@<pin>].js`, pin ladder, SRI/ETag) is
  identical, exactly as #719's `traitServePath` anticipated.

Tests: `we:definitionRegistry.test.ts` (trait resolve + union + verbatim serve), `we:fetchHandler.test.ts`
(a trait fetch 302→hash instead of 404, serves bytes at its terminal pin, unknown name still 404s).
