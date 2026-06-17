---
type: idea
workItem: story
size: 3
parent: "076"
status: open
locus: frontierui
blockedBy: ["825"]
dateOpened: "2026-06-17"
relatedProject: webcomponents
tags: [webcomponents, component, declarative, binding, observe, webexpressions, frontierui]
---

# Lower observe= and {{ }} to observedAttributes + attributeChangedCallback in generateClassSource (DC-4 B1 impl)

The FUI-owned compile-time lowering for the observe= / {{ }} contract ratified by #792 and documented in WE component.njk (#825). generateClassSource must, when a <component> carries observe="a b", emit a static observedAttributes getter listing those attrs, an attributeChangedCallback that re-runs each bound text-hole updater, and a generated per-hole textContent setter for every {{ attr }} interpolation in the template. One-way, attribute→content only — reuse the Web Expressions CustomExpressionParser restricted-sublanguage GRAMMAR to parse {{ }}, NOT the runtime registry resolution (no injector chain at build time). This is the compile-time twin of the runtime InterpolationTextNode path. Impl is FUI-owned; gate in ../frontierui.
