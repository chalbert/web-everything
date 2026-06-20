---
kind: story
size: 8
parent: "1226"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:contracts/reproduction-parity.ts"
tags: []
---

# Plateau→WE reproduction-parity verdict/delta protocol — the thin contract WE consumes

Carved from the #1225 charter (Fork 2 rider). Define the deliberately-thin protocol the Plateau vision-judgment service emits and the WE project consumes for reproduction-conformance: a per-target verdict (pass/fail per component×state×scheme, against the layered oracle — fuzzy-pixel + structural DOM/ARIA diff + advisory VLM) plus the structured GAP DELTA (what theme+intents couldn't express → backlog intake, feeds gap-sweep #315). Keep it minimal — pass/fail + gap list, NOT a fat schema; WE never renders FUI nor runs the judge, it ingests outputs only (#475 no-leakage client posture). This is the one genuine new cross-repo surface the charter mints.

## Progress — protocol defined (2026-06-20, batch-2026-06-20-1219-1228-1231-1227-1222)

The thin verdict/delta contract is authored the canonical WE way (type-only contract + registry + project surface), gate-green:

- `we:reproduction-parity/contract.ts` — the pure-contract surface (type-only, zero runtime emit, mirrors `we:analytics/contract.ts`). Minimal by ruling: `ReproductionTarget` (`system × component × state × scheme`), `OracleLeg` + `LayeredOracleReading` (pixel + structural + **advisory** VLM — the advisory leg annotates, never flips `pass` alone), `ReproductionVerdict` (the per-target pass/fail), `GapDelta` (`kind: token|intent|behavior|primitive` + description + optional `suggested` — a gap-sweep #315 intake line), and `ReproductionParityReport` (verdicts + gaps + roll-up). No screenshots/renderer-handles/oracle-internals cross the seam (#475).
- `we:contracts/reproduction-parity.ts` — the `export type *` re-export; registered in `we:contracts/package.json` exports as `@webeverything/contracts/reproduction-parity` (the Plateau→WE arrow; package-name == specifier, #239). Typecheck green.
- `we:src/_data/protocols/reproduction-parity.json` — the protocol registry entry (`ownedByProject: webaudit`, `anchor: protocol-reproduction-parity`); on the `/protocols/` catalog (verified live `:8080`).
- `we:src/_includes/project-webaudit.njk` — the anchored protocol section (the gate-required `id="protocol-reproduction-parity"` + a TS sketch of the verdict/gap/report shapes); the webaudit page renders it live (`:8080` → 200).

Gate: 0 errors (36 protocols, +1). The per-target reproduction slices + the AI-Playwright validator chain live behind this surface. Owning epic #1226 stays open (its per-system slices remain).
