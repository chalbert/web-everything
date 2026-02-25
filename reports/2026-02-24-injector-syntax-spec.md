# Research Report — Injector Syntax: Draft Specification

**Plan file**: N/A (session continuation)
**Research page**: `/research/injector-syntax-spec/`
**Date**: 2026-02-24

---

## Question

What should the formal syntax specification look like for the Web Everything injector system — covering `provide`, `consume`, and `injector` block declarations — with normative desugaring to the runtime API, both DOM and module scope integration, and honest tooling requirements?

## Recommendation

Create a three-tiered spec where every DSL construct desugars to a runtime API equivalent. The runtime API (Tier 1) is normative and requires no tooling. The DSL (Tier 3) is aspirational sugar that compiles to Tier 1. This ensures the spec is usable today while defining a clear upgrade path.

## Key Findings

### 1. Three Conformance Tiers

| Tier | Name | Requires | Status |
|------|------|----------|--------|
| 1 | Runtime API | Nothing — pure JS/TS | Partially implemented |
| 2 | TypeScript API | Standard TS compiler | Designed |
| 3 | DSL Syntax | Custom parser + transformer | Aspirational |

### 2. Critical Technical Issues Resolved

**ES Module Singleton Problem**: `import.injector` cannot work as a native runtime construct because ES Modules are cached singletons. The spec defines it as a compile-time construct with a factory-function runtime fallback (the InjectableModule pattern from plateau).

**Consume Return Type**: `consume` always returns a `Consumable<T>`, not an awaited value. This preserves:
- Synchronous context compatibility (class constructors)
- Reactive consumption (for await...of)
- Deferred resolution (provider may not exist yet)

**`as` vs `in` Semantics**: `as` = replace (new registry), `in` = extend (get-or-create + define). The `in` form desugars to existing API calls — no new runtime methods needed.

**Registry Creation**: Phase 1 requires explicit registration names. Convention-based name inference (PascalCase → kebab-case) is deferred because it's ambiguous for custom elements.

### 3. Tooling Matrix

| Tool | Can Do | Can't Do | Work Needed |
|------|--------|----------|-------------|
| esbuild | File-level pre-transform via onLoad | Parse custom keywords | Pre-transform plugin |
| TypeScript | Custom transformers, language service plugins | Parse provide/consume/injector | Pre-transform + LS plugin |
| Vite | transform hook before esbuild | Modify esbuild parser | Plugin with transform() |
| Babel | Parser extensible via plugins | Official parser fork API | Custom parser + visitor |
| Chrome DevTools | Source maps, extension API | Show injector state natively | DevTools extension |

**Critical insight**: None of this tooling blocks Phase 1. The runtime API requires zero build tool changes.

### 4. DOM vs Module Integration

Two injector types serve different scopes:
- **HTMLInjector**: targets DOM elements, validates via `target.contains(querier)`
- **ModuleInjector**: targets ImportMeta, validates all queriers

They connect via parent-chain: `ModuleInjector → document HTMLInjector → element HTMLInjectors`. This allows module-level providers to flow into the DOM tree naturally.

### 5. Phase Breakdown

**Phase 1** (Runtime API — no tooling): Consumable class, ModuleInjector, InjectableModule, Node context methods, cross-scope bridging, ProviderTypeMap interface.

**Phase 2** (DSL + Tooling): injector blocks, provide/consume statements, import.injector, HTML declarative forms, DevTools extension, TypeScript language service plugin.

### 6. Framework Comparison

Angular is the closest analog (hierarchical DI with decorators + compiler). Vue's provide/inject matches our naming. Lit's @lit/context is most aligned with web standards (DOM events). Web Everything uniquely combines hierarchical DI with registry management — no other framework manages named registries (customElements, customAttributes, etc.) through a DI hierarchy.

## Files Created/Modified

| File | Action |
|------|--------|
| `src/_data/researchTopics.json` | Added `injector-syntax-spec` entry |
| `src/_includes/research-descriptions/injector-syntax-spec.njk` | Created — full draft specification |
| `reports/2026-02-24-injector-syntax-spec.md` | Created — this report |
