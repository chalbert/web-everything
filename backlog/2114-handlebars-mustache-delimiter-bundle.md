---
kind: story
size: 5
parent: "2094"
status: resolved
blockedBy: ["2113", "2110"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: [custom-nodes, delimiter-grammar, bundle, handlebars]
---

# Handlebars/Mustache delimiter bundle

Ship the Handlebars/Mustache bundle over the #2074 recipe model (factory shape per the AUTO_DEFINE_FLAVORS precedent, fui:blocks/renderers/auto-define/CustomAutoDefineRegistry.ts): {{x}} expression, {{{x}}} raw output (distinct open), {{#if}}/{{#each}}...{{/...}} name-echo regions, {{!}}/{{!-- --}} hidden comment. {{> partial}} recorded as a pending-#1980 scorecard row, not a blocker. {{else}} mid-marker is the expected model gap — when confirmed, file the mid-region-marker decision card with the evidence. Mustache is the subset, same bundle. Scored via #2113; gap list published as a we:reports/ topic.

## Resolution (2026-07-03, #2114)

Built the Handlebars/Mustache delimiter bundle over the #2074 `CustomNode` recipe model, following the factory-shape precedent of `AUTO_DEFINE_FLAVORS`.

**FUI impl (`fui:plugs/webnodes/`):**

- **`fui:plugs/webnodes/recipes/handlebarsRecipes.ts`** — five recipe subclasses:
  - `HandlebarsTripledNode` (`{{{ }}}`, value:'shown') — raw output, distinct open, registered BEFORE `MustacheInterpolationNode`
  - `HandlebarsEachNode` (full-sigil `{{#each`, children:'inert') — each region with name-echo match-stack
  - `HandlebarsIfNode` (full-sigil `{{#if`, children:'inert') — if region; `{{else}}` gap -> decision card #2201
  - `HandlebarsCommentNode` (`{{! }}`, rendered:false marker)
  - `HandlebarsBlockCommentNode` (`{{!-- --}}`, rendered:false marker), registered BEFORE `HandlebarsCommentNode`
- **`fui:plugs/webnodes/handlebarsBundle.ts`** — `createHandlebarsBundle()` + `createMustacheBundle()` factory functions + `HANDLEBARS_BUNDLES` named flavors map. Mustache subset = `{{{ }}}` + `{{ }}` + `{{!-- --}}` + `{{! }}`.
- **`fui:plugs/webnodes/CustomNodeRegistry.ts`** — `#regionNeedle()` helper: detects full-sigil region opens (`open.endsWith(regionName)`) and uses `open` alone as the needle, avoiding the spurious double-name that concatenation would produce for `HandlebarsEachNode` / `HandlebarsIfNode`.
- **`fui:plugs/webnodes/__tests__/unit/handlebarsBundle.test.ts`** — 25 unit tests: recipe identity + config, factory, grammar-fidelity scorecard (100% / 6/6 in-scope), Mustache subset (100% / 4/4), upgrade walks (value:'shown', children:'inert', rendered:false comment).

**WE data + reports:**

- **`we:design-systems/grammars/handlebars.grammar.json`** — checklist updated: added `{{!-- --}}` block comment; `{{> partial }}` and `{{else}}` moved to out-of-scope with explicit reasons.
- **`we:reports/2026-07-03-delimiter-bundle-grammar-fidelity.md`** — Handlebars section updated: 17% -> 100%; constructs table reflects the bundle's six reproduced constructs.
- **`we:backlog/2201-mid-region-marker-else-decision-card.md`** — `{{else}}` mid-region-marker decision card filed per the #2094 epic instruction ("the first confirming gap list earns the decision card, not a guess"). Three forks documented; recommendation: park (Fork 3) until #2115 Liquid/Jinja + #2118 Svelte confirm and multi-framework evidence matures the Fork-1 `mid` axis design.

**Scored via #2113:** Handlebars bundle scores **100%** (6/6 in-scope constructs reproduced). 4 out-of-scope: `{{> partial }}` (pending-#1980), `{{else}}` (gap confirmed -> #2201), attribute-keyed helpers (#1986), attribute-value interpolation (sibling surface).
