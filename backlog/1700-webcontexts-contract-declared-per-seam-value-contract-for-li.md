---
kind: story
size: 5
status: resolved
locus: webeverything
relatedTo: ["1632", "1697", "400", "1091", "237"]
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "we:webcontexts/contract.ts"
tags: []
---

# webcontexts contract — declared per-seam value-contract for live conformance validation

The declared contract shape each provider/context seam promises for its value, exposed introspectably so the live contract/data inspector (#1632/#1697) can validate the actual value crossing the seam against the declaration and flag the offending path on drift. webcontexts ships the runtime (claim/negotiation/lookup #1091/#1115/#1117) and introspection emits provider-consumer edges (#400, resolved) — but neither declares a value SHAPE per seam to check against; that declared per-seam contract is the missing piece for actual-vs-declared validation, and is distinct from the over-time/snapshot half of #1632 (separately gated on the trace substrate #1667). Type-only WE contract slice on the webcontexts standard; the inspector consumes it, it does not own it. Adjacent to #237 (inter-module communication contracts as Protocols).

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Shipped mirroring the webidentity/webpermissions contract style — a pure, compile-erased type-only module
+ the published-package surface:

- **`we:webcontexts/contract.ts`** — the per-seam value-contract: a small declarative, JSON-serializable
  `ValueShape` vocabulary (`primitive`/`object`{fields,exact}/`array`/`union`/`any`, each with `optional`)
  expressive enough for **path-level** drift; `SeamValueContract` (a seam id + its declared `ValueShape`);
  `ContextValueContracts` (the set in force); and the inspector's result types `SeamValueDrift`
  (`{ seam, path, kind: missing|extra|type-mismatch, expected, actual }`) + `SeamValidationResult`. The
  `path` is dot/bracket JSON-path-ish so the inspector can highlight the exact offending node — the #1632/#1697 ask.
- **`we:contracts/webcontexts.ts`** type-only re-export + `./webcontexts` entry in
  `we:contracts/package.json`.

The missing declared-shape piece: webcontexts ships the runtime (claim/negotiation/lookup #1091) and #400
emits provider-consumer edges, but neither declared a per-seam value SHAPE. Type-only — the inspector owns
the validation runtime that walks `ValueShape` against an actual value. Distinct from the over-time half of
#1632 (gated on #1667). Typecheck clean.

**Gate note (not this changeset):** same two concurrent-session externals as this batch's other WE items
(`we:reports/2026-06-23-1704-split-analysis.md`, stale `we:AGENTS.md`); neither names a `we:webcontexts/`
file. Stepped over per the batch external-red diagnosis.
