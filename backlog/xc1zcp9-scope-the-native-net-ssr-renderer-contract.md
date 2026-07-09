---
kind: story
size: 3
parent: "2360"
status: open
dateOpened: "2026-07-09"
tags: []
---

# Scope the native .NET SSR renderer contract

Scope the from-scratch native .NET renderer's internal contract so #2360's build slices can be carved. The `/slice 2360` run found the epic could-not-split *because* this contract doesn't exist yet — no .NET impl surface in-repo to ground slices against. This is that missing first slice: its artifact turns #2360 into a set of `size ≤ 3` build stories.

Scope, from the resolved design lineage:

- **Package / project layout** — the .NET project structure for the renderer under `frontierui:plugs/webdirectives/ssr/`.
- **Parser strategy** — how the authoring-template source is parsed into the directive tree (all 7 directive types: for-each keyed+empty, if, switch/case, resource:loader, defer).
- **The `ServerRenderer` seam shape in .NET** — mirroring the Node reference seam (#2064) so the .NET renderer is a drop-in behind the same WE wire contract.
- **Harness invocation** — how the cross-language conformance harness (the #2354 contract + `we:conformance-vectors/webdirectives-ssr.vectors.json`) grades the .NET renderer byte-for-byte.
- **The build-slice breakdown** — the per-directive-family stories #2360 decomposes into once the above is fixed.

**Not a fork** — #2030 ruled every language's internal render strategy a conforming black box, explicitly not a ratifiable decision, so this is pure scoping/design-artifact work, not a `kind: decision`. Conforms to the wire format (#2063) + harness (#2354). Home is **FUI impl** (WE #6 — WE ships no renderer).
