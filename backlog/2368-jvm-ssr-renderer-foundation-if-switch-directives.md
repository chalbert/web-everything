---
kind: story
size: 5
parent: "2355"
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-10"
graduatedTo: "frontierui:plugs/webdirectives/ssr/jvm/ (JVM native SSR renderer foundation + if/switch, #2368)"
tags: []
---

# JVM SSR renderer foundation + if/switch directives

Stand up the greenfield JVM build subtree (frontierui:plugs/webdirectives/ssr/jvm/) for the native SSR renderer: source parse + top-level template-is dispatch loop + normative space-padded marker wrapping + renderMarkerOptions + shared helpers (resolvePath, mustache interpolate), plus the JVM-side cross-language conformance harness runner that reads we:conformance-vectors/webdirectives-ssr.vectors.json and byte-compares per the #2354 contract, wired into the JVM build's test task + repo CI. Includes the two branch-select directives if + switch (they share interpolate innerHtml and their resume tokens ride generic renderMarkerOptions) to prove the pipeline end-to-end. Demo: passes if, switch, state-tokens vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box). The foundational slice B/C ride on.
