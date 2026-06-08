# Dev authoring preferences as cross-tool intents — adapt incumbents, fill the architecture holes

Research backing [backlog #150](/backlog/150-dev-authoring-preferences-architecture-intents/). It started from a small concrete question — *why does the JSX demo write `class` not `className`?* — and generalised into: **what is the standard for cross-tool configuration of developer preferences, and where are the holes that no tool fills?**

The thesis, after research: the **overlap zone** (formatting, linting, whitespace, dialect, import boundaries) is well-served by incumbents — so Web Everything should **adapt to / lower into them, not reinvent them**. The genuine **white-space** is higher-level *architecture & component-scoping rules* expressed as **declarative intent over the introspectable app model**, portable across stacks — which no current tool does. This keeps community objection low (we drive the tools you already use) while concentrating the new surface where there's an actual gap.

> Market facts gathered 2026-06-07 from vendor docs and current comparison sources; treat exact feature claims as directional.

---

## 1. The cross-tool dev-preference landscape — fragmented by layer, almost nothing neutral

There is **no single neutral cross-tool standard**. Preferences scatter across ~8 layers, each with its own file; tools mostly don't read each other.

| Layer | Where it lives | Cross-tool? |
|---|---|---|
| Whitespace / editor | `.editorconfig` | ✅ the only truly universal one — deliberately narrow (indent, EOL, charset, final newline). Prettier and most editors read it natively |
| Formatting | `.prettierrc`, `biome.json`, dprint | ❌ per-tool |
| Linting | `eslint.config.js` (flat), Biome, Oxlint | ❌ per-tool |
| Language | `tsconfig.json` / `jsconfig.json` | partial — VS Code honours it |
| VCS | `.gitattributes` | overlaps EditorConfig on line endings |
| Toolchain / runtime | `.nvmrc`, `.node-version`, `.tool-versions`, `mise.toml`, corepack `packageManager`, Volta | ❌ per-manager (mise is the 2026 consolidator, asdf-plugin-compatible, also does tasks) |
| Environment | `devcontainer.json` (containers.dev) | ✅ ambitious but heavyweight |
| Editor | `.vscode/settings.json`, JetBrains `.idea/` | ❌ editor-locked |

Two structural facts:

- **The 2026 trend is consolidation under one *vendor's* config, not a shared neutral schema.** Biome (v2.3, Jan 2026) replaces ESLint + Prettier with a single `biome.json` and is becoming the default for new projects. EditorConfig stays the lone cross-tool standard *precisely because* it stays tiny.
- **None of them express *intent* — they encode *mechanics.*** `singleQuote: true`, `indent: 2`, `rule X: error`. There is no "I prefer concise native HTML names" that lowers into the right ESLint rule **and** codegen flag **and** formatter option together. `class`-vs-`className` is the perfect specimen: an **adapter codegen-dialect preference** with no home in any of these files.

## 2. The adapter-over-tools principle — don't reinvent, lower into incumbents

Where an incumbent already owns a concern, Web Everything should write an **adapter that lowers a declared preference into that tool's native config** (registry + adapter pattern; native-first). The JSX adapter *is already* a dialect adapter — `class`/`for`/`onclick` is one preference baked in, with `className`/`htmlFor` tolerated.

This framing is also the answer to the **"is this yet another standard?"** objection. Positioned as *a thin declarative layer that drives the tools you already use* (emit/own the Prettier, ESLint, EditorConfig, tsconfig config from one declaration), there is almost nothing to object to — teams keep their toolchain; WE orchestrates it. The objection only bites if WE ships a *competing config language*. So it shouldn't: the "standard" shrinks to a **schema for intents that lower into existing tools.**

## 3. The architecture / scoping holes — verified, and only partly empty

Honest finding: the **import-boundary** slice is *well-served* — these are adapter targets, not holes.

- **dependency-cruiser** — framework-agnostic; dependency/boundary rules, circular deps, orphans, "shared-enough" detection, graph visualisation. The most powerful.
- **Sheriff** — framework-agnostic, TS; fine-grained folder-level rules, standalone CLI or ESLint integration.
- **Nx module boundaries** — tag-based, monorepo-scoped.
- **eslint-plugin-boundaries** — element-type boundaries via ESLint.
- **ArchUnit** (Java) / **JMolecules** (.NET/PHP) — declarative, tag/marker-based `layeredArchitecture()` style. Closest existing thing to "architecture as intent" — but per-ecosystem.

But three genuine holes none of them fill:

1. **They all reason about the *import graph*, never the *running app model*.** "Directory A can't import B" — never "this widget may only live inside that container," "this state is private to this scope," "this intent is owned here." Component **scoping** over the actual composition / context / intent graph is barely touched. WE can declare it because the app is introspectable (`webcontexts` scoped data, registries, intents); incumbents reverse-engineer it from imports.
2. **Ecosystem-locked.** JS tools vs ArchUnit (Java) vs JMolecules (.NET/PHP). No portable cross-stack architecture contract.
3. **Enforcement-only, not a shared declaration.** Rules live in a linter config that *checks* — they are not an architecture *intent* that codegen, scaffolding, docs, and an AI agent all read. The 2026 direction agrees with the instinct: an O'Reilly Radar piece frames fitness functions through MCP as an anticorruption layer that lets architects "state governance intent without coupling to implementation" — nascent, and exactly this gap.

So the white-space is not "architecture rules" (those exist) but **architecture/scoping as declarative intent, over the introspectable app model, portable across stacks, consuming the existing boundary checkers as adapters where they reach.**

## 4. Web Everything's fit

The missing primitive already exists in the stack: **lower a high-level declaration into concrete per-tool output** — the render-strategy lowering compiler ([#078](/backlog/078-render-strategy-lowering-compiler/)) and how UX intents realise through providers. A **Dev Authoring Preferences** layer is the dev-facing mirror of UX intents: declarative preferences that *lower into* `.editorconfig`/Biome/ESLint/tsconfig/adapter dialects rather than replacing them, plus a native architecture-intent surface for what no tool reaches. It also extends the [#140](/backlog/140-dev-surface-product-feature-matrix/) dev-surface thesis (semantic vs heuristic, portable vs framework-bound, verifiable vs plausible) from runtime tooling to authoring-time governance.

## 5. Direction (three tiers, for resolution)

- **Build — the differentiated surface:** architecture & component-scoping rules as declarative intents over the app model, lowering into dependency-cruiser / Sheriff / ESLint where they can express it, native-checked only for what they can't.
- **Park — the on-the-fence piece:** dev-preference *adapters* over existing formatters/linters/EditorConfig. Low novelty; carries the "competing standard" risk. Capture, don't build yet.
- **Seed — agent-ready proof:** make the JSX `class`/`className` (`for`/`htmlFor`, `onclick`/`onClick`) dialect configurable, default `class` — the first working dev-preference adapter and a concrete proof of the lowering pattern.

## Open questions

Collected on [#150](/backlog/150-dev-authoring-preferences-architecture-intents/); to resolve later.

1. **Is "a standard" the right framing at all,** or should this ship purely as *adapters + an architecture-intent schema* with no "standard" branding, to avoid community objection?
2. **Scope of the architecture-intent surface** — which rule classes are in v1? (component containment/scoping, state visibility, intent ownership, layering, dependency direction). Which are native-checked vs delegated to an adapter?
3. **Lowering vs native checking boundary** — when a rule *can* be expressed in dependency-cruiser/Sheriff/ESLint, do we always lower to it (single enforcement engine) or also keep a native check (portability across stacks without those tools)?
4. **Conflict & precedence** — if a lowered tool config and a WE intent disagree (hand-edited `.prettierrc` vs declared preference), who wins? Generate-and-own, or merge?
5. **Surface in the standard** — is this a new top-level entity (like Protocol), a Project-owned concern, or part of the adapter family? (cf. [[feedback_protocol_first_class]], [[feedback_catalog_auto_render]] if it needs a catalog page.)
6. **Relationship to the Technical Configurator** — should dev preferences be a configurator domain in plateau-app ([[project_technical_configurator]]) so the lowering choices are data-driven?
7. **Does the architecture-intent surface need the introspectable runtime model to exist first** (depends on webcontexts/registries maturity), i.e. is it blocked on [#140](/backlog/140-dev-surface-product-feature-matrix/)-class work?

---

## Sources

- [EditorConfig vs ESLint vs Prettier — w3tutorials](https://www.w3tutorials.net/blog/editorconfig-vs-eslint-vs-prettier-is-it-worthwhile-to-use-them-all/), [Prettier configuration (reads .editorconfig)](https://prettier.io/docs/configuration), [EditorConfig deep dive](https://tenthirtyam.org/dispatches/2026/05/03/editorconfig-deep-dive-syntax-properties-and-best-practices/)
- [Biome migration guide 2026](https://dev.to/pockit_tools/biome-the-eslint-and-prettier-killer-complete-migration-guide-for-2026-27m), [Biome migrate from ESLint+Prettier](https://biomejs.dev/guides/migrate-eslint-prettier/)
- [mise vs proto vs asdf 2026](https://www.pkgpulse.com/guides/mise-vs-proto-vs-asdf-polyglot-version-managers-2026), [Dev Container Features](https://containers.dev/features)
- [Nx enforce module boundaries](https://nx.dev/docs/features/enforce-module-boundaries), [Sheriff](https://github.com/softarc-consulting/sheriff), [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries), [Three ways to enforce boundaries in Nx](https://www.stefanos-lignos.dev/posts/nx-module-boundaries)
- [Fitness functions — InfoQ](https://www.infoq.com/articles/fitness-functions-architecture/), [Fitness functions automating architecture decisions](https://lukasniessen.medium.com/fitness-functions-automating-your-architecture-decisions-08b2fe4e5f34)
- [React v19 (custom elements; className unchanged)](https://react.dev/blog/2024/12/05/react-19), [React DOM common components](https://react.dev/reference/react-dom/components/common)
