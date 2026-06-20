---
kind: story
size: 5
parent: "097"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: []
---

# Upgrader version-migration planner — changelog-manifest consumption + version-gated migration selection

Build slice (a) of the ratified #191 version-migration upgrader. Consume the changelog-manifest protocol (#102) as the migration descriptor and add a version-gated planner on #094's upgraderEngine: given installed→target spec versions, select the migration entries in (>installed, <=target], ordered and intermediate-spanning — the Angular `ng update` run loop, mapped onto #266's `compareSpecVersions`/`featureAvailableIn`. Output is an ordered migration plan the transform interpreter (slice b) executes and the input-adapter/mode (slice c) wires into `verifyUpgrade`. Ready now — no open fork (placement + authoring ratified in #191).

## Progress (2026-06-13) — resolved

New [we:blocks/renderers/upgrader/versionMigrationPlanner.ts](../blocks/renderers/upgrader/versionMigrationPlanner.ts) — `planVersionMigration(installed, target, manifests, pkg?)` → `MigrationPlan { steps, spannedVersions, reachedTarget }`. The *across-versions* counterpart of #094's *legacy→standard* upgrade:

- **Consumes the changelog-manifest (#102) verbatim** — the `ChangelogManifest` / `ChangelogEntry` / `MigrationRef` shapes mirror the resolved protocol (per-module entries keyed to semver `severity` + Keep-a-Changelog `type`; `migration` linkage on breaking entries). Mirrored locally so the planner is self-contained, not a new schema.
- **Version-gated + intermediate-spanning** — walks the `previous → release` chain from `installed`, at each hop taking the manifest with the **smallest** `release` in `(current, target]` (using #266's `compareSpecVersions`), so a `1→3` shortcut never skips the `2.x` deprecation window. Collects only entries carrying a `migration` ref (breaking + mechanically applicable), ordered installed→target — the `ng update` run loop.
- **Honest about gaps** — a missing manifest stops the walk with `reachedTarget: false` + the partial steps (never claims a path it can't plan); downgrades and mixed-package sets throw `MigrationPlanError`.

Output is the ordered plan the transform interpreter (slice b, #191) executes and the input-adapter/mode (slice c) feeds through `verifyUpgrade`. 9 unit tests; gate green; type-clean (the tsc note is the pre-existing `tsconfig.plugs` rootDir artifact, now also covering the cross-dir `compareSpecVersions` import — the gate runs vitest, which resolves it).
