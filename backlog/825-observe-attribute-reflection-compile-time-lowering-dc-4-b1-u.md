---
type: idea
workItem: story
size: 3
parent: "076"
status: open
dateOpened: "2026-06-17"
tags: [webcomponents, component, declarative, binding, observe, webexpressions]
---

# observe= attribute reflection — compile-time lowering (DC-4 B1, unplugged twin of webexpressions)

DC-4 B1, ratified by #792. Add the unplugged/build-time binding path to the <component> lowering: observe="a b" declares observed attributes; {{a}} in the template lowers (generateClassSource) to static observedAttributes + attributeChangedCallback + a generated per-hole textContent updater. One-way, attribute->content only. Reuses the shipped webexpressions expression GRAMMAR (CustomExpressionParser restricted sublanguage), NOT the runtime registry resolution (no injector chain at build time) — it is the compile-time twin of the existing InterpolationTextNode runtime path. Contract lands in component.njk; lowering impl is FUI-owned (generateClassSource).
