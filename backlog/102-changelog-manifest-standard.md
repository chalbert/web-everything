---
type: idea
workItem: story
size: 5
parent: "099"
status: open
dateOpened: "2026-06-06"
tags: [changelog, manifest, versioning, semver, migration, codemod, auto-update, standard, evergreen, machine-readable]
relatedReport: reports/2026-06-06-front-end-platform-book.md
relatedProject: webmanifests
crossRef: { url: /backlog/101-auto-update-pipeline/, label: "Auto-update pipeline (#101)" }
---

# Changelog manifest standard — machine-readable, per-module change descriptors that drive automatic migration

A standard for a **machine-readable changelog**: for each release, a manifest describes — **per file/module** — the *nature* of every change (major / minor / patch) and, where possible, the **migration script** that applies it. The essay calls this the *Changelog Standard* ("format for human readability + API for libs describing which files changed and the nature of each change") and makes it the linchpin of safe auto-update: risk analysis, auto-codemods, and incremental delivery all read from it.

## Why a manifest, not just a CHANGELOG.md

A human changelog can't be acted on by a machine. This artifact is the **contract the auto-update pipeline (#101) and upgraders (#094) consume**: it lets the pipeline classify an update's risk automatically, apply the bundled migration for breaking changes without hand-editing call sites, and lets incremental delivery (#103) compute exactly which modules changed. It is also what #088 hinted at ("the standard should publish machine-readable change/migration descriptors per release") and what #094 named as a dependency.

## What it must capture

| Field | Purpose |
|---|---|
| Per-module change entries | the unit is the module/file, not the whole package — so consumers know exactly what moved |
| Change nature (major/minor/patch) | drives risk routing and semver derivation |
| Migration script reference | the codemod that mechanically applies a breaking change (#094) |
| Human-readable summary | the dual format the essay calls for (machine + readable) |

## Relationship to existing versioning items

- **#005** — spec/capability-manifest versioning for the validation engine.
- **#088** — served-artifact (MaaS) versioning / content-addressing.
- **This (#102)** — the *change-description* format that sits between releases and tooling; it's what makes #088's version bumps and #101's auto-migration actionable. Likely a **webmanifests** standard (it's a manifest), aligned with Conventional Commits / semver vocabulary rather than inventing one.

## Open questions

- Borrow existing vocabulary (Conventional Commits, semver, Keep a Changelog) for the human layer; standardize only the **machine schema** + the migration-script linkage (the novel part).
- How migration scripts are authored, versioned, and trusted (they run codemods on consumer code) — the security/trust angle ties to #101's security-analysis step.
