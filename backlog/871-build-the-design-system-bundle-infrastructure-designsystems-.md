---
type: idea
workItem: story
size: 5
parent: "746"
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: src/_data/designSystems.json
relatedProject: webtheme
tags: [webtheme, design-system, registry, catalog, decision-build]
---

# Build the design-system bundle infrastructure: designSystems.json registry + /design-systems/ catalog + validator

Execute #747 Fork-3-A: stand up the design-system bundle as a real surface. Add the designSystems.json registry (manifests of shape { extends, themeTokens (DTCG ref), intentDefaults?, traitDefaults? } extending the platform default), a /design-systems/ catalog page auto-rendered from it (the protocols.njk/intents.njk precedent), the base.njk nav entry, an authoring note, and a validateDesignSystem rule in check-standards-rules.mjs (every non-token field optional, themeTokens resolves, extends resolves). This is the unbuilt prerequisite every successor presupposes — #749 switcher, #751 Plateau-embed, #754 export, and the #864 WE-docs dogfood bundle all author into a registry that does not yet exist.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `src/_data/designSystems.json` — the thin rendering index (two seeds: `material-like` full bundle, `acme-brand` colors-only minimal).
  - `design-systems/*.designsystem.json` manifests of shape `{ extends, themeTokens, intentDefaults?, traitDefaults? }` + their referenced DTCG `*.tokens.json` files.
  - `src/design-systems.njk` — the `/design-systems/` catalog, auto-rendered from the index (project + status filters, mirrors `protocols.njk`).
  - `base.njk` nav entry beside Protocols/Presets; `vite.config.mts` proxy allowlist (`design-systems`) so :3000 serves it.
  - `validateDesignSystem` rule in `check-standards-rules.mjs` (+ `FILE.DesignSystem`) wired into `check-standards.mjs` §6b-ter — two layers: registry fields + manifest shape (themeTokens required & resolves, extends resolves, intentDefaults keys resolve, traitDefaults free-form presentational slot). Pure (manifest reads injected); unit-tested (8 cases + real-data-stays-clean).
  - Authoring note in `docs/agent/architecture.md` (entity-table row + how-to).
- **Verified:** `check:standards` 0 errors; rules test 137 passed; 11ty dryrun clean; `/design-systems/` renders 200 on :8080 and :3000 with both seed cards.
- **Notes:** Per-design-system detail pages and live theme switching are #749's job (the switcher loads a manifest); this item stands up only the registry/catalog/validator substrate the successors author into.
