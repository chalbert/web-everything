# Research Report — Map Statement Analysis

**Source page**: `/research/injector-syntax-proposals/` (section 4.4)
**Date**: 2026-02-24

---

## Question

Is the `map` statement in the DSL proposals (Layer 4) still relevant, or is it fully covered by `provide`? And is there separate value for `map` as a URL-mapping concept (like `importmap`)?

## Recommendation

Remove the `map` statement from the DSL proposals. It overlaps entirely with `provide` for injection use cases, and for URL resolution the browser's native `importmap` already exists.

## Analysis: Map Examples vs Provide

| # | Map Example | Provide Equivalent | Covered? |
|---|-------------|-------------------|----------|
| 1 | `map 'react' from './lib/react'` | `provide './lib/react' as 'react'` | Yes — aliasing a provider under a different name |
| 2 | `map { 'react', 'react-dom', '@company/core' } from import.injector` | `provide { 'react', 'react-dom', '@company/core' } from import.injector` | Yes — selectively re-providing parent injector entries |
| 3 | `map * from import.injector` | `provide * from import.injector` | Yes — already shown in section 4.2 with this exact syntax |
| 4 | `map 'react' from module { ...React, createElement: mock() }` | `provide module { ...React, createElement: mock() } as 'react'` | Yes — providing an inline mock as a named provider |

**Conclusion:** All four examples are fully covered by `provide ... as` (replace) and `provide ... from` (re-expose).

## URL-Mapping Concern

The `importmap`-style use case — bare specifier resolution — operates below the injector system. It's about how `import 'react'` resolves at module load time, not about dependency injection at runtime. The browser's native `importmap` already handles this:

```html
<script type="importmap">
{ "imports": { "react": "./lib/react.js" } }
</script>
```

If Web Everything wanted to express URL mapping declaratively, it would be a configuration concern (like `importmap`), not an injector statement.

## Key Findings

1. **`map` adds no capability over `provide`** — the `as` (replace) and `from` (source) modifiers on `provide` already express every pattern `map` was used for.
2. **URL resolution is a separate concern** — the browser's native `importmap` handles bare specifier mapping at the loader level, which is orthogonal to runtime injection.
3. **`map` creates confusion** — having two keywords for overlapping semantics increases cognitive load without adding expressiveness.

## Files Created/Modified

| File | Action |
|------|--------|
| `reports/2026-02-24-map-statement-analysis.md` | Created — this report |
