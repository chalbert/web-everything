---
kind: story
size: 5
parent: "2360"
status: open
dateOpened: "2026-07-10"
tags: []
---

# Native .NET SSR renderer foundation + if/switch directives

Stand up the greenfield .NET build subtree (frontierui:plugs/webdirectives/ssr/net/) for the native SSR renderer: source parse (a real HTML parser/DOM, e.g. AngleSharp, mirroring the Node happy-dom strategy — the parser choice is a conforming black box per #2030, not a fork) + top-level template-is dispatch loop + normative space-padded marker wrapping + RenderMarkerOptions + shared helpers (ResolvePath, mustache Interpolate), plus the .NET-side cross-language conformance harness runner that reads we:conformance-vectors/webdirectives-ssr.vectors.json and byte-compares per the #2354 contract, wired into dotnet test + repo CI. Includes if + switch (share interpolate innerHtml, resume tokens ride generic RenderMarkerOptions) to prove the pipeline end-to-end. Demo: passes if, switch, state-tokens vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box). The foundational slice B/C ride on.
