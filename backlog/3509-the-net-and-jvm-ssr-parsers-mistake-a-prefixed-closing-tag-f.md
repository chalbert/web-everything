---
bornAs: xu4dn9h
kind: story
size: 2
status: open
dateOpened: "2026-09-06"
tags: []
---

# The .NET and JVM SSR parsers mistake a prefixed closing tag for the real one

The hand-rolled parsers in the .NET and JVM SSR ports name-boundary-check a same-prefix OPENING tag before
deepening the nesting counter, but match the CLOSING tag by raw byte prefix — so `</casestudy>` is taken for
`</case>` and truncates the region. Reproduced by execution against the JVM port: inner comes back as
`<casestudy>deep` instead of `<casestudy>deep</casestudy>tail`, and the renderer emits malformed HTML. Rust
fixed the same defect in #2756; Python is unaffected. No vector exercises the shape, so CI is silent.

## Done when

1. **Executable** — in each port, a parser unit test asserting
   `<case when="a"><casestudy>deep</casestudy>tail</case>` yields inner `<casestudy>deep</casestudy>tail`.
   Red before, green after, in BOTH the .NET and JVM suites.
2. Both ports route the open and close arms through ONE shared boundary check, so the two sides cannot drift
   apart again — the shape `#2756` used in Rust (`is_tag_name_end`, with `/` admitted only on the open side).
3. Consider whether a conformance vector should cover a prefixed nested tag, so the class is caught by the
   shared oracle in every future port rather than per-port unit tests.
