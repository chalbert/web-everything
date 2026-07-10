---
kind: story
size: 3
parent: "2360"
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: "backlog/xs764ci-native-net-ssr-renderer-foundation-if-switch-directives.md + backlog/xt0pnxx-native-net-ssr-renderer-for-each-directive-keyed-empty-count.md + backlog/x99fk2i-native-net-ssr-renderer-resource-loader-defer-directives.md (#2374)"
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

## Resolved (batch-2026-07-09) — scoped, reconciled against the JVM pattern, and filed as three build slices under #2360

Re-ran the `/slice 2360` investigation grounded in the Node oracle (`frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts`) and reconciled it against the JVM (#2355) re-analysis already on record: the oracle's directives are independent plugs on a dispatch map (parse+dispatch, marker rendering, shared helpers, five per-directive `DirectiveRenderer`s), not a rigid `parse → expand-all-7 → emit` chain — so .NET fans out the same `foundation → {for-each, resource:loader+defer}` shape JVM did, not a single atomic build. Full pass recorded in `we:reports/2026-07-09-backlog-split-analysis.md` (`/slice 2360` reconciliation section).

- **Project layout** — greenfield `.NET` build subtree at `frontierui:plugs/webdirectives/ssr/net/` (class-library project + an xunit test project), mirroring `frontierui:plugs/webdirectives/ssr/`'s existing Node layout.
- **Parser strategy** — a real HTML parser/DOM (AngleSharp is the .NET analog of Node's happy-dom strategy — parses `<template is>` source, gives insertion-order-preserving serialization); the exact library choice is a conforming black box (#2030), recorded as a build note for the foundation slice, not decided here.
- **`ServerRenderer` seam** — a pure `(source, data) => string` delegate/interface, mirroring `frontierui:plugs/webdirectives/ssr/ServerRenderer.ts:33`.
- **Harness invocation** — an xunit test in the foundation slice that loads `we:conformance-vectors/webdirectives-ssr.vectors.json`, invokes the renderer per vector, and byte-compares per the #2354 contract, wired into `dotnet test` + CI.
- **Build-slice breakdown, filed as #2360's children (siblings of this item):**
  - foundation + if/switch — `we:backlog/xs764ci-native-net-ssr-renderer-foundation-if-switch-directives.md` (story·5)
  - for-each — `we:backlog/xt0pnxx-native-net-ssr-renderer-for-each-directive-keyed-empty-count.md` (story·3, `blockedBy` foundation)
  - resource:loader + defer — `we:backlog/x99fk2i-native-net-ssr-renderer-resource-loader-defer-directives.md` (task·2, `blockedBy` foundation)

#2360's body updated to a "Sliced" framing recording the DAG. The same re-analysis is still owed for #2356–2358 (Go/PHP/Rust) — flagged in the report, out of this item's .NET-only scope.
