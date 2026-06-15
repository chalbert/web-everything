---
type: issue
workItem: task
parent: "507"
status: open
blockedBy: []
dateOpened: "2026-06-15"
tags: [module-as-a-service, polyglot, dotnet, csharp, generation-adapter, conformance]
---

# Generated C# MaaS origin won't compile — NameValueCollection has no TryGetValue

The #548 C# backend emits `query.TryGetValue("form", out var _form) ? _form : null` where `query` is the NameValueCollection returned by `System.Web.HttpUtility.ParseQueryString` — which has no TryGetValue method, so GeneratedMaaSOrigin.cs does not compile. Surfaced by the #549 execution-conformance gate (it compiles the byte-locked golden AS-IS). Fix the csharp.ts backend (blocks/renderers/module-service/generation/backends/csharp.ts:130) to emit `query[name]` (returns string?/null), regenerate the goldens (npm run gen:maas-origin), and re-run check:maas-conformance on a .NET 8+ toolchain to confirm a green execution run. Blocks the generated origin passing #549 at all.
