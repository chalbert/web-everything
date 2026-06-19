---
type: idea
workItem: story
size: 5
parent: "1021"
status: resolved
blockedBy: ["1057"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:manifests/reader.ts"
tags: []
---

# webmanifests reader — changelog-manifest reader runtime in FUI

Slice B of webmanifests impl epic #1021 (blockedBy slice A contract). Implement the changelog-manifest reader runtime in FUI (parse + expose a changelog manifest), conforming to the WE contract.

## Progress

Shipped the changelog-manifest **reader runtime** — the runtime-impl half over the #1057 contract,
interim byte-replicated in WE (`locus: frontierui`, future `@frontierui` package), mirroring the landed
`intl/` (#1055) and `reliability/` (#1052) provider precedents:

- `we:manifests/reader.ts` — `ChangelogReader` over a `ChangelogManifest`: per-module entry queries
  (`entries`/`entriesFor`/`bySeverity`/`breaking`/`withMigration`) realizing the *unit is the module*
  ruling; `releaseSeverity()` = the **strictest-wins** derivation (any `major` ⇒ `major`, else `minor`,
  else `patch`; empty ⇒ `patch`) so semver is a *derived* fact, never hand-asserted; and
  `verifyMigration(migration, actualHash)` = the integrity **gate** the #101 pipeline runs before
  trusting a codemod (declared `integrity` must be non-empty *and* equal the caller-computed content
  hash). The reader does the comparison only — computing the content hash (I/O over the codemod file) is
  the pipeline's security step, so the reader stays pure/dependency-free. Re-exports the contract surface
  (file-seam split, like `we:intl/provider.ts`).
- `we:manifests/index.ts` — default wiring: `readManifest(manifest)` factory (the one reader entry
  point) + re-export. No swappable registry — a reader is a stateless projection, not a provider slot.
- `we:manifests/__tests__/reader.test.ts` (13 vitest cases: per-module/by-severity/breaking/migration
  queries, all four strictest-wins severity bands incl. empty-manifest, the integrity gate's
  match/mismatch/empty-hash paths) + the `manifests/**/__tests__` glob in `we:vitest.config.ts`.

Reader surface aligns with the #1059 conformance demo's in-demo reader (`entriesFor`/`bySeverity`/
`breaking`/`withMigration`). Closes slice B of #1021.
