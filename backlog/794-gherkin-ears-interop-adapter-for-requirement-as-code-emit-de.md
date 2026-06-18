---
type: idea
locus: frontierui
workItem: story
size: 5
status: resolved
blockedBy: ["100", "804"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: adapters/requirement-as-code/gherkinEars.ts
tags: [requirement-as-code, adapters, gherkin, ears, interop, ingestion, evergreen]
crossRef: { url: /backlog/714-requirement-meta-schema-bdd-like-format-relationship-to-webc/, label: "Meta-schema ratified by #714" }
---

# Gherkin/EARS interop adapter for requirement-as-code — emit (deterministic) + subset ingest (lossy)

Build the format-interop adapter pair around the #714-ratified requirement meta-schema (the neutral pivot): EMIT (schema → Gherkin/EARS) is a deterministic downward projection — every typed requirement renders to a valid Given/When/Then scenario, lossless on prose, subset-trivial for EARS; INGEST (Gherkin → schema) is subset-deterministic (controlled step library → semantics/protocols lookup) + AI-assisted/lossy for free-form steps via the #475-served checker, where the unmappable residue IS the 'no ground truth' lint #100 wants. Same doctrine as #552/#426 (ingest) and #463 (forward/generation). Deferred: blocked on the #100 impl existing; sequence after slice A (authoring corpus). Adapter is impl → locus frontierui per #552.

## Also blockedBy #804 — added 2026-06-16 (batch-2026-06-16)
#100 is now resolved (the schema exists), but this adapter is `locus: frontierui` and must consume the WE-resident `RequirementRecord` contract (`we:webcases/requirementValidator.ts`). Frontier UI has **no established way to import a WE contract type today** — no `@webeverything` package dependency or path alias (verified), and `RequirementRecord` is published as no contract package. Establishing that import surface is exactly the **open decision [#804](/backlog/804-establish-the-we-contract-export-package-surface-consumable-/)** (WE contract-export package surface). Building this adapter now would either pre-empt #804 by fiat or mirror the type as a hack; added `blockedBy: 804` so it sequences after that ruling. (The deterministic EMIT + subset INGEST halves are ready on the schema side; only the cross-repo contract-consumption path is missing.)

## Progress — built the deterministic adapter (2026-06-16, batch-2026-06-16)

Both blockers resolved (#100 schema, #804 export mechanism). The `webcases` contract placement is
unambiguous (a WE standard, #714-ratified), so exporting it applied the ratified #804 mechanism (no new
fork — unlike #725's subsystem-placement gap, #817):

- **WE export delta** — `we:webcases/package.json` (`@webeverything/webcases`, exports
  `./requirementValidator`), mirroring the #814 scoped-package pattern (`name == specifier`, #239). FUI
  `we:tsconfig.json` paths + `vite.config.mts` alias map the specifier to the sibling source. The contract is
  imported **type-only** (erased at runtime; the record never leaves WE).
- **Adapter (impl → FUI per #463/#552)** — `fui:frontierui/adapters/requirement-as-code/gherkinEars.ts`:
  `emitGherkin` / `emitEars` (deterministic downward projection, byte-identical, no I/O) +
  `ingestGherkin` (subset-deterministic over a controlled step grammar; emit templates and ingest
  matchers derive from one `STEP_GRAMMAR`, so a typed record round-trips exactly). Every unmappable line
  surfaces as an `IngestFinding` (info = the #100 free-form residue; error = a scenario missing a slot) —
  never silently dropped. AI-assisted recovery of free-form steps stays a Plateau-served concern (#475,
  no-leakage), out of this deterministic core.
- **New FUI adapter home** — established `adapters/` as the impl home for #463/#552 interop adapters;
  added to FUI `we:vitest.config.ts` include + `we:tsconfig.json` include (typecheck-covered).
- **Tests** — `fui:adapters/requirement-as-code/__tests__/gherkinEars.test.ts` (9): emit shape (Gherkin +
  EARS + role), determinism, emit→ingest round-trip, free-form residue, missing-slot error, multi-scenario.
  Green. FUI `check:standards` green (0/0); project `tsc --noEmit` 0 errors.
