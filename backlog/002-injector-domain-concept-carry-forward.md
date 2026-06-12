---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: '2026-02-24'
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: Protocol
tags:
  - injector
  - domain
  - dsl
  - plateau-migration
  - design-decision
relatedReport: reports/2026-02-24-plateau-syntax-gap-analysis.md
relatedProject: webinjectors
---

# Decide whether to carry plateau's @domain injector concept into WE

Gap analysis of the plateau DSL found the critical missing core idea to be @domain — an abstract namespace where "the domain IS the contract" (consumers say "I need date math" without naming date-fns/dayjs/Temporal), distinct from concrete registries. The open decision: model domains as Option A (naming convention over injector set/get), Option B (first-class concept with provideToDomain/consumeFromDomain resolution), or Option C (defer until DSL build tooling exists). Sibling open threads: the provide…to / consume…of prepositions, and the <script type="injector"> declarative form (most immediately actionable, via customScriptTypes). Phased plan spec'd but unstarted.

## Decision (2026-06-11) — `@domain` *is* a Protocol

**Ruling: `@domain` is not a new primitive. A domain is a [Protocol](/protocols/); the `@scope/name` string is the Protocol's identity.** The domain string is a purely semantic handle that *communicates* a contract space — it does not itself resolve anything.

Reasoning, settled in discussion:

- **Collision avoidance, the original motive, is discharged by Protocol ownership — not by the bare string.** Plateau introduced `@domain` because the DI space is global and two modules both providing on `'date'` could mean different things. But pure namespacing (Option A as a flat unique string) only moves the collision from `date` to `@date/core` — it prevents *name* collision, not *semantic* collision. The thing that actually prevents "two providers meaning different things" is a shared agreed contract for what `@date/core` provides. That agreed contract **is** a Protocol. So the collision requirement, taken seriously, forces domain to be a Protocol.
- **The space is global *and* open.** DI is not WE-only: any package may define and own its own domains via scoped namespacing (`@vendor/…`), coexisting conflict-free — the same open-system principle as custom intents (standardize the meta-schema, not the list). WE holds no monopoly on the namespace.
- **A domain maps to one (possibly multi-member / "fat") Protocol.** Unlike today's single-behavior Protocols (positioning-strategy, render-strategy), a domain Protocol like `@date/core` has a multi-member surface (addMonths, startOfMonth, …). Same resolution mechanism; Protocol identity does the collision avoidance regardless of member count.
- **Impl binding rides the module-resolution axis (#264/#271/#274)** — a generator hint that materializes into the native importmap/alias, *not* a new runtime resolver.

**Rejected — Option B** (first-class `@domain` primitive with `provideToDomain`/`consumeFromDomain`): stands up a third resolution axis next to Protocol + module-resolution and reintroduces a runtime resolver that #271 explicitly ruled out.

**Adopted — A at the model layer + C on the build-time DSL + one slice pulled forward:**
1. Model: domain = Protocol vocabulary, no new primitive (ratified above).
2. Defer the build-time `provide/consume` DSL (prepositions `to`/`of`/`as`/`in`, `import.injector` source-lists) — needs build tooling; documented-as-intended, not built. → spun off as a decision item.
3. Pull forward only the runtime declarative `<script type="injector">` form via the existing `customScriptTypes` (no build step, Demo-First). → spun off as an actionable item.

graduatedTo: **Protocol** (the @domain concept now lives as Protocol semantics; no new entity).

## Progress

- **Status:** resolved — ruling recorded; spin-offs scaffolded.
- **Done:** A/B/C decided (B rejected); domain = Protocol; open + global namespace; binding via module-resolution axis.
- **Next:** spun off as #278 (declarative `<script type="injector">` slice, actionable) and #279 (deferred `provide/consume` DSL, decision).
- **Notes:** see Decision section; no code in this item — it's a ruling.
