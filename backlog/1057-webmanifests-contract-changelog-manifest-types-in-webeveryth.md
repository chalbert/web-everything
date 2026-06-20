---
kind: story
size: 3
parent: "1021"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:manifests/changelog-contract.ts"
tags: []
---

# webmanifests contract — changelog-manifest types in @webeverything

Slice A of webmanifests impl epic #1021. Define the changelog-manifest contract (manifest schema types) in @webeverything per the resolved #102 changelog-manifest protocol design. Type-only crosses the seam (npm scope mirrors layer). Foundation slice — B and C build on it.

## Progress

Shipped `we:manifests/changelog-contract.ts` — the pure-contract half (compile-erased, future
`@webeverything/contracts/changelog-manifest`): `Severity` (semver verbatim), `ChangeType` (Keep a
Changelog vocab), `ChangelogEntry` (per-module unit), `MigrationRef` (codemod ref + integrity/author
trust fields), `ChangelogManifest`. Mirrors the schema contract specified verbatim in
`we:src/_includes/project-webmanifests.njk` (#102 design). Runtime reader / severity-derivation /
migration-verification stay impl (→ FUI). Borrows semver + Keep a Changelog vocabularies, invents none.
