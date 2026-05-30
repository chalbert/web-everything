# Architecture — Plugs, Blocks, Injectors, Registries

> Tier-1 reference. Read when changing core primitives, wiring, or parsers.

## Architectural Principles
- **Protocol over Implementation**: define the interface (TS Interface), not the library.
- **Intents are UX protocols**: describe the desired interaction (the "what/why") at project level. Documentation of app behavior, *not* a component library.
- **Behaviors are implementations**: custom attributes (`layout:grid`) attach functionality. Not Intents.
- **Design System superset**: Intents must be abstract enough to configure any major design system (Material, Carbon, Fluent…). A design system is just a config of Web Intents + CSS.
- **Native alignment**: align with existing Web APIs (`Storage`, `EventTarget`, `CustomElementRegistry`) over framework patterns.
- **Dependency injection**: use Web Injectors for all composition.
- **Zero-build first**: works in the browser (ES Modules); build-time optimization is additive.

## Plugs vs Blocks

| Layer | Purpose | Location | Window global | Examples |
|-------|---------|----------|---------------|----------|
| **plugs** | Core primitives, patches, registries | `plugs/` | Yes (via bootstrap) | CustomStore, CustomAttribute, InjectorRoot |
| **blocks** | Reusable implementations | `blocks/` | No (import directly) | SimpleStore, OnEventAttribute, CallParser |

- **Plugged mode**: bootstrap applies patches, exposes globals on `window`.
- **Unplugged mode**: direct imports, no patches, tree-shakeable.

## Key patterns

**Injector system** — DI via DOM tree traversal:
```typescript
injector.set('customContexts:handlers', handlers);
InjectorRoot.getProviderOf(element, 'customContexts:handlers');
```

**Registry pattern** — named registration:
```typescript
attributes.define('on:click', OnClickAttribute);
parsers.define('call', new CallParser());
```

**Parser pipeline** — composable via reduce; parsers try in order, wrapping previous results:
```typescript
registry.parse('save($event) | validate'); // CallParser then PipeParser
```

## File organization
```
plugs/      bootstrap.ts · core/ · webstates/ · webinjectors/ · webbehaviors/
            webcontexts/ · webregistries/ · webcomponents/ · webexpressions/ · webdirectives/
blocks/     stores/ · parsers/ · attributes/ · router/ · view/ · tabs/ · navigation/
            for-each/ · transient/ · renderers/ · text-nodes/ · resource-loader/
demos/      declarative-spa.html and variants
```

## Common tasks
- **New store**: `blocks/stores/{name}/{Name}Store.ts` extends `CustomStore` → `index.ts` → register in `blocks/stores/index.ts` → document (see [design-first.md](./design-first.md)) → tests.
- **New parser**: implement `parse(input, context)` → `ParseResult`; include `evaluate(resolved)`; register in `plugs/bootstrap.ts`; document.
- **New event attribute**: use `createOnEventAttribute()`; register `attributes.define('on:eventname', AttributeClass)`; common events go in `registerEventAttributes()`.
- **Modify the demo**: `demos/declarative-spa.html` has a `text/plain#demo-js-source` (shown in viewer) and a `type="module"` (running) section — **keep both in sync**.

## Debugging
```typescript
for (const injector of element.injectors()) console.log(injector.providers); // injector chain
const r = registry.parse('expr'); console.log(r.success, r.expressions, r.remaining); // parser
```
Subclass `CustomAttribute` and log in `connectedCallback`/`disconnectedCallback` to trace lifecycle.
