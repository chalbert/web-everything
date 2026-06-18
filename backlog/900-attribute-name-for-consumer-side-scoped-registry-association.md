---
type: decision
workItem: story
size: 2
parent: "076"
status: preparing
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
tags: []
---

# Attribute name for consumer-side scoped-registry association (scope is overloaded — registry= vs alternatives)

Carved from #854 (which ratified that scoped registration lives off `<component>`, as a runtime declared-registry + IDREF-association + binding-behavior model). #854 settled the model; this settles only the NAME of the association attribute a consumer carries to bind a declared registry by id (working name `scope=`). 'scope' is overloaded (CSS `@scope`, lexical/JS scope). The shipped injector precedent uses `injector="id"`, so `registry="id"` is the consistent analog that dissolves the overload. Decide: `registry=` vs `scope=` vs `use-registry=` vs another token (plus any component-side sugar). Low-stakes, but its own ratification so #854's model isn't held on a bikeshed.
