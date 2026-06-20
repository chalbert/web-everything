---
kind: story
size: 3
parent: "076"
status: resolved
locus: frontierui
blockedBy: ["825"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: frontierui/compiler/src/component-transform/emit-imperative.ts
relatedProject: webcomponents
tags: [webcomponents, component, declarative, binding, observe, webexpressions, frontierui]
---

# Lower observe= and {{ }} to observedAttributes + attributeChangedCallback in generateClassSource (DC-4 B1 impl)

The FUI-owned compile-time lowering for the observe= / {{ }} contract ratified by #792 and documented in WE we:component.njk (#825). generateClassSource must, when a <component> carries observe="a b", emit a static observedAttributes getter listing those attrs, an attributeChangedCallback that re-runs each bound text-hole updater, and a generated per-hole textContent setter for every {{ attr }} interpolation in the template.

One-way, attribute→content only — reuse the Web Expressions CustomExpressionParser restricted-sublanguage GRAMMAR to parse {{ }}, NOT the runtime registry resolution (no injector chain at build time). This is the compile-time twin of the runtime InterpolationTextNode path. Impl is FUI-owned; gate in ../frontierui.

## Progress

**Resolved 2026-06-17 (batch-2026-06-17). Locus: frontierui.**

FUI's `generateClassSource` is the component-transform `emitImperative` (`fui:compiler/src/component-transform/emit-imperative.ts`). Implemented through the IR contract (one field + paired parse/emit), so the byte-identical round-trip holds.

- **IR** — added `observe: readonly string[]` to `ComponentIR` (`fui:ir.ts`), plus the compile-time `{{ }}` grammar: `HOLE_PATTERN` + `parseHoles`, reusing the Web Expressions DoubleCurlyBracketParser `{{`/`}}` delimiter contract but **restricting** the inner sublanguage to a bare attribute identifier — no dotted paths / pipes / calls and **no runtime registry/injector** (the build-time twin of `InterpolationTextNode`).
- **Declarative edge** (`fui:declarative.ts`) — `parseDeclarative` reads `observe="a b"` (whitespace-split, omitted → `[]`); `emitDeclarative` re-emits it when non-empty.
- **Class emit** (`fui:emit-imperative.ts`) — when `observe` is present, emits `static get observedAttributes()`, a one-time `#bind()` (TreeWalker over the cloned tree that splits each `{{ attr }}` for an observed attr into a managed `Text` node — non-observed `{{ x }}` left literal — then applies the initial attribute value), `#apply(name, value)` (the per-hole `textContent`/`.data` setter), and `attributeChangedCallback` that re-applies. One-way, attribute→content only; the `{{ }}` stays verbatim in `TEMPLATE.innerHTML` so the round-trip is byte-identical. **`observe`-absent output is unchanged** (existing fixtures stay byte-identical).
- **Imperative edge** (`fui:imperative.ts`) — `parseImperative` recovers `observe` from the `static observedAttributes` getter, so both round-trip directions are fixed points.
- **Tests** — new `fui:observe-binding.test.ts` (7 cases, happy-dom): parse/grammar, structural emit, the unchanged absent-case, byte-identical round-trip both directions, **live** attribute→content binding (initial + change), and non-observed `{{ x }}` staying literal. Full component-transform suite 39/39; FUI `check:standards` green; `tsc` clean.

`graduatedTo` → `fui:frontierui/compiler/src/component-transform/emit-imperative.ts`.
