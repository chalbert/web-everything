---
name: impl-details-are-not-forks
description: "A decision is a fork only for what's observable across the impl boundary; how it's built isn't a ratifiable fork"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bd35f767-609b-436d-9e89-28faf1d8362c
---

When preparing or deciding, a choice is a **fork / standard concern only if it has impact observable
across the implementation boundary** — the external I/O (wire format, emitted grammar, attributes, the
contract other code/langs consume). *How* the surface is built internally (DOM-shim vs string renderer,
adopt-vs-restamp, method names, token layout only the impl itself reads) is a **black-box impl detail — not
a ratifiable fork**. Surface only external-impact forks; collapse black-box impl to recorded defaults.

Corollary for a cross-language/multi-impl surface: the **wire format is the swap seam** — it's the WE
standard (+ WE-owned conformance vectors, the #817/#899 data-not-impl pattern); each language/renderer
conforms behind it. A native-first reuse trick (e.g. reusing the JS client via a server DOM shim) is a
legit *reference-impl* choice but confers no cross-language rule. Codified for rendering at
`docs/agent/platform-decisions.md#ssr-external-io-standard-renderers-conform` (#2030); this memory is the
*general* decision-method form.

**Why:** the user overturned a prepped decision (#2030) on the merits — five "forks" were mostly impl
details; only the external I/O was a real call. A prep that lists impl choices as forks over-asks the
human and mis-frames WE #6 (WE holds the standard; FUI implements).

**How to apply:** for each candidate fork, ask "can anything outside the boundary observe the difference?"
No → record a default, don't ask. Yes → it's a fork, and likely belongs in the WE standard, not the impl.
Distinct axis from [[merit-forks-not-prioritization]] (principle-vs-timing) — this is observable-vs-internal.
