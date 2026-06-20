---
kind: story
size: 3
parent: "081"
status: resolved
locus: frontierui
blockedBy: ["389"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: frontierui/packages/maas-check/
tags: []
---

# Frontier UI — jsx-runtime API-contract-version export + maas-check opt-in compat validator

The Frontier UI implementation half of #088 option B (WE defines the contract; Frontier UI implements it). Add an __API_VERSION__ contract-version export to @frontierui/jsx-runtime, bumped only on public-API change (decoupled from package semver), so the runtime advertises which API contract it satisfies. Ship @frontierui/maas-check: an opt-in validator that resolves the runtime through a consumer's import map, reads __API_VERSION__, fetches each served artifact's compat range (#389), and fails loud on mismatch — as a CI/resolve-time check and an optional load-time guard. Inert unless the consumer opts in; mandates nothing.

## Progress — resolved 2026-06-13

Built in **frontierui** (locus frontierui):

- **`__API_VERSION__` export** — `fui:packages/jsx-runtime/src/apiVersion.ts` (`export const __API_VERSION__ = 1`)
  re-exported from the package root. A single monotonic integer **decoupled from package semver**, bumped
  only on a public-API change an already-served artifact could observe — the runtime's advertised
  contract version (maas-versioning §4).
- **`@frontierui/maas-check`** (new package) — the opt-in validator over a pure core:
  - `satisfiesCompatRange` (min inclusive, max exclusive) + `parseRange` (`"2"`, `"1..3"`, `">=1 <3"`) +
    `formatRange`.
  - `checkCompat` (structured result) / `assertCompat` (throws a `MaasCompatError` — resolve-time) /
    `guardCompat` (non-throwing — load-time).
  - `readCompatRangeFromHeaders` + `fetchArtifactCompat` reading the range off the
    `x-maas-runtime-compat` header (the #389 metadata leg), with an **injected fetch** so the core is
    network-free and testable.
  - `runMaasCheck` — the CI entry: checks every artifact against the runtime, throws an aggregated
    `MaasCompatError` naming the incompatible artifact(s); `failOnMissingRange` opt-in for undeclared
    ranges. **Inert unless a consumer wires it in.**
  - we:package.json (jsx-runtime an optional peer) + tsconfig, added to the root `build:packages`.
- **Tests** — `fui:packages/maas-check/__tests__/maas-check.test.ts` (12, all green): range math, all parse
  forms, assert/guard, header read, injected-fetch, the aggregated-throw + missing-range paths, and a
  cross-leg check that `__API_VERSION__` is a usable positive integer.
- Gates: `tsc` clean (jsx-runtime + maas-check), `vitest` 12/12, frontierui `check:standards` 0 errors.

**Graduated to** `frontierui/packages/maas-check/` — new @frontierui/maas-check package (satisfiesCompatRange/parseRange/assertCompat/guardCompat/runMaasCheck, header-read + injected fetch) + jsx-runtime __API_VERSION__ export (fui:packages/jsx-runtime/src/apiVersion.ts); 12 vitest green.
