---
kind: story
size: 3
status: open
dateOpened: "2026-07-02"
tags: []
---

# Make the 80% coverage rule real: widen the include beyond blocks and wire coverage into the gate chain

we:AGENTS.md declares an 80% coverage minimum but nothing ever invokes test:coverage, and the vitest coverage include only spans we:blocks/ so ~30 other tested planes are invisible to the number. Widen the include to every tested plane, wire --coverage into regression/CI, or strike the rule from we:AGENTS.md — a stated-but-unenforced rule trains agents that the rules are optional.
