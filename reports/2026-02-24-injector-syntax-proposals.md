# Research Report — Provide/Consume/Injector Syntax Proposals

**Plan file**: User request (IDE review of web injectors vs plateau)
**Research page**: `/research/injector-syntax-proposals/`
**Date**: 2026-02-24

---

## Question
What provide/consume/injector syntax was explored in the plateau project, and what should carry forward to Web Everything?

## Recommendation
Document all four layers (runtime API, HTML declarative, decorators, language-level DSL) as a reference catalog. Prioritize runtime primitives (Consumable, consume() query syntax, Node context methods) for near-term migration. Treat the language-level DSL as aspirational — valuable design ideas (`as` vs `in`, `import.injector`) but blocked on build tooling. Decorators and HTML script types need further evaluation against Web Everything's "native browser APIs" philosophy.

## Key Findings

### Four Syntax Layers Identified
1. **Runtime API** (implemented in plateau) — Consumable class, injector.consume() with path expressions, Node context methods, scoped createElement
2. **HTML Declarative** (partially explored) — `<script type="expression|context|bindings">` with consume/provide keywords, `@context` and `#id` binding references
3. **Decorators** (implemented with legacy TC39) — `@provide()`, `@provideState()`, `@context()` on classes/fields
4. **Language-level DSL** (proposals only) — `injector {}` blocks, `provide`/`consume`/`map` statements, `import.injector` reference

### Key Design Ideas Worth Preserving
- **`as` vs `in` semantics**: `provide X as 'registry'` replaces; `provide X in 'registry'` extends/merges
- **`import.injector`**: Reference to current module's injector context (like import.meta for injection)
- **Consumable as multi-resolving async primitive**: Promise + AsyncIterator in one object
- **Query syntax**: `'providerName/path.to.value'` for deep context access

### Also Found: 4 TypeScript Type Proposals
- `with` statement for type narrowing (relevant for injected globals)
- `definitely`/`maybe` type restrictors
- Import type casting via `with` keyword
- Negated types (`A ~ B`)
These are TS language-level proposals, not directly actionable.

## Files Created/Modified
| File | Action |
|------|--------|
| `src/_data/researchTopics.json` | Added `injector-syntax-proposals` and `injector-migration-gaps` entries |
| `src/_includes/research-descriptions/injector-syntax-proposals.njk` | Created — full syntax catalog across all 4 layers |
| `src/_includes/research-descriptions/injector-migration-gaps.njk` | Created — detailed gap analysis with migration order |
| `reports/2026-02-24-injector-syntax-proposals.md` | This report |
| `reports/2026-02-24-injector-migration-gaps.md` | Companion report for migration gaps |
