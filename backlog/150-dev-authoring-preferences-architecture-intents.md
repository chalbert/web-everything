---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-07"
tags: [dev-experience, authoring-preferences, architecture-rules, component-scoping, adapters, lowering, jsx-adapter, native-first]
relatedReport: reports/2026-06-07-dev-authoring-preferences-architecture-intents.md
crossRef: { url: /backlog/140-dev-surface-product-feature-matrix/, label: "Dev-surface feature matrix (#140)" }
---

# Dev authoring preferences as cross-tool intents — adapt incumbents, fill the architecture holes

Decide how (and whether) Web Everything should express **developer authoring preferences** — the dev-facing mirror of UX intents. Research ([related report](reports/2026-06-07-dev-authoring-preferences-architecture-intents.md)) found the overlap zone (formatting, linting, whitespace, dialect, import boundaries) is already well-served by incumbents, so WE should **adapt to / lower into them, not reinvent**. The real white-space is higher-level **architecture & component-scoping rules** expressed as declarative *intent over the introspectable app model*, portable across stacks — which no current tool does.

Started from a concrete question (*why does the JSX demo use `class` not `className`?* — intentional: it's the HTML mirror dialect, `className` tolerated as an alias). That generalised to "what's the standard for cross-tool dev-preference config, and where are the holes?"

## Direction (three tiers — to resolve)

- **Build — differentiated surface:** architecture & component-scoping rules as declarative intents over the app model, lowering into dependency-cruiser / Sheriff / ESLint where they can express it, native-checked only for what they can't. Minimal community objection — no incumbent to threaten.
- **Park — on the fence:** dev-preference *adapters* over existing formatters/linters/EditorConfig/tsconfig. Low novelty; carries the "competing standard" risk. Capture, don't build yet.
- **Seed — agent-ready proof:** make the JSX `class`/`className` (`for`/`htmlFor`, `onclick`/`onClick`) dialect configurable, default `class` — the first working dev-preference adapter and a concrete proof of the lowering pattern. Spin this out into its own item when we resolve.

Connects to the render-strategy lowering compiler ([#078](/backlog/078-render-strategy-lowering-compiler/)) (same lower-a-declaration-into-concrete-output pattern) and extends the [#140](/backlog/140-dev-surface-product-feature-matrix/) dev-surface thesis from runtime tooling to authoring-time governance.

## Open questions (resolve later)

1. **Is "a standard" the right framing at all,** or ship purely as *adapters + an architecture-intent schema* with no "standard" branding, to dodge community objection?
2. **Scope of the architecture-intent surface** — which rule classes in v1? (component containment/scoping, state visibility, intent ownership, layering, dependency direction.) Which native-checked vs delegated to an adapter?
3. **Lowering vs native checking** — when a rule *can* be expressed in dependency-cruiser/Sheriff/ESLint, always lower to it (single engine) or also keep a native check (portability without those tools)?
4. **Conflict & precedence** — lowered tool config vs a hand-edited `.prettierrc`/eslint config: who wins? Generate-and-own, or merge?
5. **Surface in the standard** — new top-level entity (like Protocol), a Project-owned concern, or part of the adapter family? Does it need a catalog page?
6. **Relationship to the Technical Configurator** — should dev preferences be a configurator domain in plateau-app so lowering choices are data-driven?
7. **Prerequisite** — does the architecture-intent surface need the introspectable runtime model first (webcontexts/registries maturity), i.e. is it blocked on #140-class work?
