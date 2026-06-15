---
type: issue
workItem: story
size: 2
parent: "507"
status: open
blockedBy: ["661"]
dateOpened: "2026-06-15"
tags: [module-as-a-service, polyglot, dotnet, csharp, generation-adapter, conformance]
---

# Generated MaaS origin needs an injected form-catalog seam (unknown-form 400 + form default)

The serve-path IR contracts a 400 for an unknown `form`, but the form catalog is an implementation concern, not the neutral contract (OriginCore.cs). #548's generated origin has neither the catalog nor a seam for it, so it can't mint the unknown-form 400 — the #549 conformance host supplies it. The generated shell should expose an injected form-validator/catalog seam (mirroring resolve/resolver) so a conforming origin produces the 400 itself, and should default a missing `form` to the origin's default (the JS reference uses `wc-class`; the generated origin passes `null` — a latent identity divergence). Fix the backends + servePathIR, regenerate, verify.
