---
kind: decision
status: open
scope: ["we:conformance-vectors/webdirectives-ssr.vectors.json", "frontierui:plugs/webdirectives/ssr/"]
dateOpened: "2026-09-07"
tags: []
---

# webdirectives-ssr wire format: define HTML-escaping behavior for {{path}} interpolation

Every native SSR renderer built against we:src/_includes/project-webdirectives.njk#ssr-wire-format (frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts and its JVM/.NET/Go ports, #2368/#2383/#2755) interpolates {{path}} mustache values into the emitted HTML with no HTML-escaping of <, >, &, " — discovered as a #2755 convergence finding. No we:conformance-vectors/webdirectives-ssr.vectors.json vector exercises an HTML-metacharacter-bearing interpolated value, so no renderer is graded on escaping either way, and every per-language port has independently inherited the reference renderer's unescaped semantics (a stored/reflected XSS sink if render data ever carries attacker-influenced text). Decide whether interpolation should escape HTML metacharacters (and in which contexts — text vs. attribute position), then add a conformance vector exercising the ratified behavior so every language twin is graded on it deterministically. A policy/contract call, not a per-renderer code fix.

## Done when

- The fork is ruled and the ruling codified (statute or `we:docs/agent/*.md`, per the resolve gate for a
  `kind: decision`): does `{{path}}` interpolation escape HTML metacharacters, and if so, in which
  contexts (text vs. attribute position)?
- A conformance vector in `we:conformance-vectors/webdirectives-ssr.vectors.json` exercises an
  HTML-metacharacter-bearing (`<`, `>`, `&`, `"`) interpolated value and pins the ratified `expectedHtml`.
- Every language twin graded against that vector (Node reference, JVM #2368, .NET #2383, Go #2755, and any
  later port) either already conforms or gets a follow-up build item to conform — filed here, not
  half-done in this decision's own diff.
