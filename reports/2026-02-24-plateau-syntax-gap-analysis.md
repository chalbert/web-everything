# Research Report — Plateau DSL Syntax Gap Analysis

**Source page**: `/research/injector-syntax-proposals/`
**Date**: 2026-02-24

---

## Question

Does the current research page (`injector-syntax-proposals.njk`) fully capture all DSL syntax explored in the plateau-app, or has functionality been dropped?

## Recommendation

The research page is missing **8 significant features** from the plateau DSL. The most critical gap is the **domain concept** (`@domain` abstract namespaces), which was the central organizing idea of the entire injection system. The research page should be updated, and the domain concept should be evaluated for carry-forward to Web Everything.

---

## Gap Analysis

### Gap 1: Domain Concept (`@domain` Abstract Namespaces)

**Severity: Critical — this is the core design idea**

The plateau DSL introduced `@domain` strings as abstract contracts that decouple consumers from providers. This is fundamentally different from registries:

- **Registry** (e.g., `customElements`, `customContexts:nav`): A concrete, typed namespace for a specific kind of provider. The consumer knows what kind of thing it's getting.
- **Domain** (e.g., `@date/core`, `@ui/icons`, `@definitions`): An abstract contract. The consumer says "I need date math functions" without knowing if it's `date-fns`, `dayjs`, or `Temporal`.

```typescript
// Domain consumption — consumer doesn't know the implementation
consume { addMonths, startOfMonth } of '@date/core';
consume { ChevronLeft, ChevronRight } of '@ui/icons';

// Registry consumption — consumer knows the provider type
consume nav from 'customContexts:nav';
```

The domain IS the contract. `@auth/session` and `@analytics/session` can coexist without collision.

**Current research page status**: No mention of domains. All examples use registry paths like `customContexts:nav`.

### Gap 2: `provide * to '@domain' from source` Syntax

**Severity: High**

The `to` keyword in provide directs values to a specific domain:

```typescript
export injector AppEnvironment {
    provide * to '@date/core'     from DateFnsAdapter;
    provide * to '@date/fmt'      from DateFnsAdapter;
    provide * to '@ui/floating'   from FloatingUIDOM;
    provide * to '@ui/icons'      from FontAwesomeIcons;
}
```

The current research page documents `provide ... as` (replace) and `provide ... in` (extend), but **not** `provide ... to` (domain targeting). These are three distinct prepositions with three distinct semantics:

| Preposition | Semantics | Example |
|-------------|-----------|---------|
| `as` | Replace registry | `provide { Button } as 'customElements'` |
| `in` | Extend/merge into registry | `provide { Button } in 'customElements'` |
| `to` | Target abstract domain | `provide * to '@date/core' from DateFnsAdapter` |

**Current research page status**: Section 4.2 has `as` and `in` but not `to`.

### Gap 3: `consume ... of` Preposition

**Severity: Medium**

Plateau used `of` (not `from`) when consuming from a domain:

```typescript
consume { Resource } of '@definitions';
consume { format }   of '@date/fmt';
```

While `from` was used for consuming from registries:

```typescript
consume nav from 'customContexts:nav';
```

This distinction may be intentional — `of` suggests membership in an abstract set, `from` suggests a concrete source.

**Current research page status**: Section 4.3 uses `from` for everything.

### Gap 4: `provide fallback` Syntax Evolution

**Severity: Low**

The original syntax was:
```typescript
// Original (commit cbab7da)
provide fallback { Logger } from './console-logger';

// Revised (commit e4b6ef7)
provide { Logger } from import.injector, './console-logger';
```

The revision eliminated the `fallback` keyword in favor of a comma-separated source list where `import.injector` takes priority. This evolution should be documented as a design decision.

**Current research page status**: Not mentioned at all.

### Gap 5: HTML `<script type="injector">` Declarative Syntax

**Severity: Medium**

A complete HTML declarative form was explored:

```html
<!-- Define an injector with a unique id -->
<script type="injector" id="theme-injector">
    provide { theme } from './theme-dark.js';
</script>

<!-- Associate a node with the injector by id -->
<my-widget injector="theme-injector"></my-widget>

<!-- Isolate attribute prevents parent inheritance -->
<script type="injector" id="isolated" isolate>
    provide { theme } from './theme-contrast.js';
</script>

<!-- Meta reference to current injector in from clause -->
<script type="injector" id="custom-elements-injector">
    provide * of 'customElements' from injector;
</script>
```

Key features:
- `id` attribute identifies the injector
- `injector="id"` attribute on elements associates them
- `isolate` boolean attribute prevents parent inheritance
- `injector` keyword (not `import.injector`) as meta reference in `from` clause

**Current research page status**: Layer 2 covers `<script type="expression|context|bindings">` but NOT `<script type="injector">`.

### Gap 6: Hollow Calendar Case Study

**Severity: Medium (documentation value)**

The most compelling real-world example showing domain-based injection in practice — a "hollow" calendar widget that injects date math, localization, positioning, and icons from abstract domains. This was the centerpiece of the plateau project page.

**Current research page status**: Not included.

### Gap 7: `export injector` Syntax

**Severity: Low**

Injectors as exportable modules:

```typescript
export injector definitions {
    const Resource = 100;
    provide { Resource };
}
```

**Current research page status**: Section 4.1 shows `injector PageName { }` but not the `export` modifier.

### Gap 8: Registry vs Domain Distinction

**Severity: High (conceptual)**

The plateau DSL made a clear architectural distinction:

| Concept | Prefix | Purpose | Example |
|---------|--------|---------|---------|
| **Registry** | none or `custom*:` | Concrete typed namespace | `customElements`, `customContexts:nav` |
| **Domain** | `@` | Abstract contract | `@date/core`, `@ui/icons` |

Registries are about **what kind of provider** (elements, contexts, stores). Domains are about **what capability** (date math, icons, auth). An injector can provide to both.

**Current research page status**: No distinction made. Everything is treated as a registry path.

---

## Plan: Bring Missing Pieces to Web Everything

### Phase 1: Update Research Page (Documentation)

Update `injector-syntax-proposals.njk` to include:

1. Add new section **"Domain Concept"** between Layer 3 and Layer 4 (or as a subsection of Layer 4) explaining:
   - Registry vs Domain distinction
   - `@` prefix convention
   - "The domain IS the contract"

2. Add `provide ... to` syntax to section 4.2 (Provide Statement)

3. Add `consume ... of` syntax to section 4.3 (Consume Statement) alongside `consume ... from`

4. Add new section for `<script type="injector">` under Layer 2 (HTML Declarative)

5. Add `provide fallback` evolution as a design decision note

6. Add `export injector` to section 4.1

7. Consider including the Hollow Calendar case study as an appendix or linked example

### Phase 2: Evaluate Domain Concept for Runtime (Implementation)

The domain concept requires deciding whether domains are:

**Option A**: Just a naming convention on top of existing injector `set`/`get`:
```typescript
injector.set('@date/core', dateFnsAdapter);
const { format } = injector.get('@date/core');
```

**Option B**: A first-class concept with its own resolution rules:
```typescript
injector.provideToDomain('@date/core', dateFnsAdapter);
const { format } = injector.consumeFromDomain('@date/core');
```

**Option C**: Deferred until build tooling exists for the DSL (aspirational only)

### Phase 3: Evaluate `<script type="injector">` for Runtime

This is the most immediately actionable HTML feature. It could be implemented as a `customScriptType` registration (already noted in plateau as an extensibility point):

```typescript
customScriptTypes.define('injector', InjectorScriptHandler);
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `reports/2026-02-24-plateau-syntax-gap-analysis.md` | Created — this report |
