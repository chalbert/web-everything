---
kind: story
size: 3
parent: "076"
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: src/_includes/block-descriptions/component.njk (observe= / {{ }} contract)
tags: [webcomponents, component, declarative, binding, observe, webexpressions]
---

# observe= attribute reflection — compile-time lowering (DC-4 B1, unplugged twin of webexpressions)

DC-4 B1, ratified by #792. Add the unplugged/build-time binding path to the <component> lowering: observe="a b" declares observed attributes; {{a}} in the template lowers (generateClassSource) to static observedAttributes + attributeChangedCallback + a generated per-hole textContent updater. One-way, attribute->content only. Reuses the shipped webexpressions expression GRAMMAR (CustomExpressionParser restricted sublanguage), NOT the runtime registry resolution (no injector chain at build time) — it is the compile-time twin of the existing InterpolationTextNode runtime path. Contract lands in we:component.njk; lowering impl is FUI-owned (generateClassSource).

## Progress

Resolved 2026-06-16. The **WE contract slice** — the `observe=` / `{{ }}` compile-time binding authoring surface — landed in `we:src/_includes/block-descriptions/component.njk`:
- **Authoring contract** gained the `observe="attr-1 attr-2 …"` bullet: declares observed attributes → lowers to a static `observedAttributes` + `attributeChangedCallback` + per-hole text updater; `{{ attr }}` binds one-way (attribute → textContent only); the `{{ }}` expression reuses the **Web Expressions grammar** (`CustomExpressionParser` restricted sublanguage), NOT the runtime registry — the **unplugged compile-time twin** of the runtime interpolation-text-node path (DC-4 B1).
- **Web Standards Alignment** gained an Observed-attributes row; **Feature Inventory** row reframed to name `observe=`/`{{ }}` (DC-4 B1, built-in) vs. the composed event/output/nested-path bindings; **Composition** DC-4 note records the twin relationship.
- Literal `{{ }}` wrapped in `{% raw %}` (Nunjucks would otherwise interpret them — caught by the 11ty build smoke, which `check:standards` skips).
- **FUI-owned lowering impl** (the `generateClassSource` half) carved out to **#830** (`locus: frontierui`, `blockedBy #825`) with a full digest.
