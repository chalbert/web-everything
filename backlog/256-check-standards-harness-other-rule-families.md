---
kind: task
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: none
parent: 251
tags: [tooling, check-standards, testing, harness, coverage]
crossRef: { url: /backlog/, label: Backlog }
---

# Extend the `check-standards` unit harness to the non-backlog rule families

Surfaced closing out [#251](/backlog/251-check-standards-unit-test-harness/), which gave the validator
its first unit-test harness by factoring the **backlog** per-item rules into a pure, testable
`validateBacklogItem` (in `we:scripts/check-standards-rules.mjs`) and seeding fixtures + a standing
false-positive guard over the real backlog. That deliberately scoped to "the high-value rules, starting
with the cases #247 had to prove by hand."

The other rule families are still live-only — no unit coverage, so their false-positive safety remains a
manual check:

- **Protocols** (§6b) — required fields, `ownedByProject` / `realizesIntent` resolution, the
  project-partial anchor probe.
- **Intents** (§6c) — required fields, `dimensions` presence, `requiresCapabilities` resolution.
- **Capabilities + the build-matrix** (§6c-bis) — vocabulary shape, the complete impl × capability grid,
  the single-native-substrate invariant.
- **Reports-not-hidden** (§6e), **compiled-artifact shadow** (§8), **Vite proxy allowlist** (§9) — each
  has subtle path/regex logic that would benefit from fixture cases.

## What to do

- Follow the #251 pattern: factor each family's rule body into a pure function in
  `we:scripts/check-standards-rules.mjs` (data in → `{errors, warnings}` out), have `we:check-standards.mjs`
  compose it, and add fixtures in `scripts/__tests__/`.
- Prioritise the families with the gnarliest logic (capability-matrix completeness, the Vite-proxy
  segment-coverage regex) — those are where a silent false-positive or false-negative is most likely.
- Keep the standing "real data stays clean" guard pattern per family.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:** Factored every non-backlog rule family into pure, unit-tested functions in
  `we:scripts/check-standards-rules.mjs` — `validateProtocol` (§6b), `validateIntent` (§6c, incl. the
  relocated requiresCapabilities resolution), `validateCapability` + `validateCapabilityMatrix`
  (§6c-bis, with the grid-completeness + single-native-substrate invariants), `validateReportsNotHidden`
  (§6e), `findCompiledShadows` (§8), and the Vite-proxy trio `permalinkSegment` / `isSegmentCovered` /
  `validateViteProxyCoverage` (§9). Also extracted the shared `checkStatus` enum check + the
  `FILE`/`LIFECYCLE`/`STATUS_SYNONYMS` constants so the entity validators are self-contained and the
  script imports them back for blocks/plugs. `we:check-standards.mjs` now composes all of these (fs I/O
  stays in the script; pure logic is injected). Added `we:scripts/__tests__/check-standards-rules.test.mjs`
  — 52 fixture cases (heaviest on the matrix completeness + the proxy segment-coverage regex, the
  gnarliest logic) plus a standing "real data stays clean" guard per family. Full unit suite + live
  `npm run check:standards` both green; refactor is behavior-preserving (same 0 errors).
- **Next:** —
- **Notes:** No per-family real-data guard for §8 (compiled-artifact shadow) — its live fs walk is the
  production check and the pairing logic is covered by synthetic cases; documented in the test file.
  Not worth a follow-up item.

## Notes

- Not blocking: the live `npm run check:standards` run remains the production gate; this is the same
  regression-hardening rationale as #251, extended to the rest of the validator.
