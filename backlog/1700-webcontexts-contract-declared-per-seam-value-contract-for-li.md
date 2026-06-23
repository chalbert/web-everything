---
kind: story
size: 5
status: open
locus: webeverything
relatedTo: ["1632", "1697", "400", "1091", "237"]
dateOpened: "2026-06-23"
tags: []
---

# webcontexts contract — declared per-seam value-contract for live conformance validation

The declared contract shape each provider/context seam promises for its value, exposed introspectably so the live contract/data inspector (#1632/#1697) can validate the actual value crossing the seam against the declaration and flag the offending path on drift. webcontexts ships the runtime (claim/negotiation/lookup #1091/#1115/#1117) and introspection emits provider-consumer edges (#400, resolved) — but neither declares a value SHAPE per seam to check against; that declared per-seam contract is the missing piece for actual-vs-declared validation, and is distinct from the over-time/snapshot half of #1632 (separately gated on the trace substrate #1667). Type-only WE contract slice on the webcontexts standard; the inspector consumes it, it does not own it. Adjacent to #237 (inter-module communication contracts as Protocols).
