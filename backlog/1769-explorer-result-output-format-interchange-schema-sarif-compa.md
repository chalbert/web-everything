---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: none
tags: []
---

# Explorer result/output-format interchange schema (SARIF-compatible core + extension slot)

The one WE artifact minted by #1747 (explorer is otherwise a closed Plateau product). Specify a finding/report interchange schema — severity, location, oracle id, evidence, run/coverage summary — so any tool or CI can consume explorer output without depending on the closed product. Per #1467 (WE keeps the contract, not the engine); the temporal rule is satisfied by convergent external prior art (SARIF, axe-core JSON, Lighthouse JSON), so mint a SARIF-compatible core now + an open extension slot for WE-specific fields (oracle ids, conformance-vector linkage). Distinct from the conformance binding interface (#1596). The Plateau explorer's reportBundle emits to this schema; third-party tools read it.

## Progress (batch-2026-06-26-1745-1775)

Minted the one WE artifact (#1747): a SARIF 2.1.0-compatible explorer result interchange — third-party tools
+ CI read explorer output without depending on the closed Plateau engine (#1467 — WE keeps the contract).
- `we:explorer/contract.ts` — type-only shape: a SARIF 2.1.0 log (`$schema`/`version`/`runs[].results[]`)
  whose core ANY SARIF tool reads, with every WE-specific field in SARIF `properties` bags (SARIF's own
  generic-tool-ignorable extension slot): per-result `{ oracle, stateId, evidence[], conformance{contract,
  vectorIds}, confidence }` and per-run `{ url, coverage{states,edges,coverage}, generatedAt, extensionVersion }`.
  Self-contained (no imports), so a non-TS reader can consume it. The temporal rule (#1747) is met by
  convergent prior art (SARIF / axe-core / Lighthouse).
- `we:explorer/schema.ts` — build-agnostic runtime: version constants, `severityToSarifLevel`
  (error/warn/advisory → error/warning/note), `assertExplorerInterchange` structural validator,
  serialize/deserialize, a draft-07 JSON schema, and `findingsToInterchange` — the **reference projector**
  from the explorer's native `plateau:findings.json` shape onto the interchange (the canonical mapping the Plateau
  reportBundle emits through). Oracle id is BOTH the SARIF `ruleId` (generic tools group by rule) and
  `properties.oracle` (WE-aware tools read directly).
- `we:contracts/explorer.ts` + `we:contracts/package.json` — published as `@webeverything/contracts/explorer`
  (type-only re-export, the plateau/FUI→WE arrow).
- `we:explorer/__tests__/explorer-schema.test.ts` — 12 tests (SARIF-compat, extension slot, validator,
  round-trip, projector); added the `explorer/**` glob to `we:vitest.config.ts`.

Scope held (#1467/#1747): WE owns the SHAPE + validator + reference projector; the explorer ENGINE that
produces output and the Plateau reportBundle wiring stay the closed product (a follow-on, plateau-locus).
WE gate 0 errors (scoped); 12 tests green.
