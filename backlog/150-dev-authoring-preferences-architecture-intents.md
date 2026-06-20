---
kind: decision
size: 5
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
codifiedIn: "docs/agent/platform-decisions.md#project-protocol-bar"
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

## Resolution (2026-06-09)

Governing principle established: **minimize lock-in at every layer.** We refuse to introduce a
project-facing *format/standard* (it forces permanent format maintenance + custom-solution coupling).
Surfaces classify by how much lock-in they impose:

- **Soft preferences ≠ strong protocols** (Q1, Q5). Test: violating it **breaks interoperation** → it's a
  **Protocol** (the existing first-class entity, enforced); it merely **offends a convention** → it's a
  soft **preference** (adapter-lowered, opt-in, never forced). No new "dev-preferences standard" / top-level
  entity; the architecture piece reuses **Protocol**.
- **Overlap zone (lint/format/boundaries) → a devtool normalization hub, zero lock-in** (Q1, Q3). Bottom-up:
  one adapter per incumbent (eslint/oxlint/Sheriff/dependency-cruiser/custom) → lossy internal pivot the
  project never sees → *see / re-export / shop*. Lossiness reframed as comparative value. Use-once-and-stop;
  the project keeps no reference to it. → **#236**.
- **Shopping = Technical Configurator domain** (Q6), gated on the configurator maturing past POC —
  directional, not an immediate build. Folded into #236.
- **Architecture/scoping over the running app model** is the genuine white-space but **gated on #140-class
  introspectable-model maturity** (Q7); it's an inter-module **Protocol**, not a preference. → **#237**.
- **JSX dialect (`class`/`className`)** is a soft preference, agent-ready now → **#235** (the first working
  dev-preference adapter; proves the lowering pattern).
- Q2 (rule-class scope) and Q4 (precedence) **deferred into the build items** — decided concretely, not cold.

The "is this a Protocol?" reframe came from the user: don't force practices, but inter-module communication
needs strong protocols. Even that lock is escapable — protocol ≠ implementation (swap freely), and
non-compliant modules still work, they just forfeit the injection/configuration compliant ones receive
(graceful degradation). Cross-cutting principles recorded to auto-memory (lock-in spine;
adapter-as-normalization-hub).

Spun out: **#235** (JSX dialect config, agent-ready), **#236** (validation normalization+shopping devtool),
**#237** (inter-module Protocol over app model, #140-gated). No `graduatedTo` entity yet — graduates into a
real surface once a spin-out is built.
