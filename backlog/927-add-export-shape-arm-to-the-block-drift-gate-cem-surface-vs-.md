---
type: issue
workItem: story
size: 5
parent: "904"
status: resolved
locus: webeverything
blockedBy: ["916", "917", "918", "919", "920", "921", "922", "923", "924", "925", "948"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:scripts/check-standards-rules.mjs"
tags: []
---

# Add export-shape arm to the block drift gate (CEM surface vs actual impl exports)

Add a **warn-first** second arm to the block drift gate (`validateBlockImplConformance`,
[we:scripts/check-standards-rules.mjs:1324](../scripts/check-standards-rules.mjs#L1324); wired at
[we:scripts/check-standards.mjs:780](../scripts/check-standards.mjs#L780)) that compares each block's
declared `exports` (`we:src/_data/blocks/<id>.json`) against the resolved FUI impl barrel's **actual**
exports — the deeper content-equality the #170 hazard implies (#659 shipped impl-existence only). Mirrors
the `BLOCK_IMPL_DRIFT_ENFORCED` warn-first → flip precedent ([we:scripts/check-standards-rules.mjs:1356](../scripts/check-standards-rules.mjs#L1356)).
`typescript@^5.9.3` is already a dep, so the resolver is a real TS program (not regex). locus webeverything. Slice of #904.

## Scope (post-#948, post-`/slice 927`): the resolver arm, barrel blocks, warn-first

#948 re-pointed every deep-file `implementedBy` at the enumerable index barrel. So this story is the
**single, atomic** deliverable that remains:

- A `validateBlockExportShape` arm + a **TS-program export resolver** that gathers a block's
  resolved barrel surface (e.g. `fui:blocks/router/index.ts`), **following `export type *` and `@webeverything/contracts/…`
  package-specifier re-exports** (a regex can't — this is why the re-export-following must ship *with* the
  first gather, not as a later slice: otherwise it false-fails `resource-loader`/`type-ahead`).
- Compare against the declared `exports`; **warn-first** (`EXPORT_SHAPE_ENFORCED=false`).
- **Scoped to the 7 barrel blocks.** Expected outcome: 4 pass (`router`, `for-each`, `type-ahead`,
  `resource-loader`); 3 surface as warnings — the genuine drifts, which is the gate's job (see #1165).
- **Renderer blocks (5) are logged as un-coverable** and skipped here (no barrel — see #1164).

**Demo:** `npm run check:standards` runs green, surfacing the 3 drift warnings + the renderer skip note.

## Carved-out decisions (de-buried 2026-06-19, `/slice 927` — see `we:reports/2026-06-19-backlog-split-analysis.md`)

The export-shape work embedded two real forks that this story does **not** resolve (warn-first surfaces
them; resolving them gates the eventual `EXPORT_SHAPE_ENFORCED` flip):

- **#1164** — renderer-block export-shape coverage (5 no-barrel blocks: dir-walk gather vs require FUI
  barrels vs exempt).
- **#1165** — resolve the 3 export-shape drift findings (`tabs` / `transient-component` / `view`): correct
  the contract `exports` vs file a FUI build for the missing surface.

## History — `/slice` re-scope (was size 13)

This was a `size 13` lump. The batch-2026-06-18 prototype proved the arm couldn't enforce cleanly because
of an `implementedBy`↔`exports` modeling mismatch (now fixed by **#948**) and two embedded design forks
(now carved to **#1164**/**#1165**). With those removed, the residual is the warn-first resolver arm above
— re-sized **13 → 5**, batchable. The full prior investigation lives in the git history of this file and
the post-#948 map it carried.

## Resolution (batch-2026-06-19)

Added the warn-first export-shape arm:

- `validateBlockExportShape` + `EXPORT_SHAPE_ENFORCED = false` in `we:scripts/check-standards-rules.mjs` (pure rule: a declared export ABSENT from the resolved barrel is the drift; extras are fine; `actualExports === null` → skip).
- Wired as §8e in `we:scripts/check-standards.mjs`: a **real TS program** (typescript dep, not regex) over the 7 barrel entry files using FUI's `fui:tsconfig.json`, resolving each barrel's actual exports via `checker.getExportsOfModule` — so `export type *` and `@webeverything/contracts/…` package re-exports are **followed** (proven: `router`/`for-each`/`type-ahead`/`resource-loader` pass; a regex would false-fail the contract-re-exporting ones). Detect-or-skip when `../frontierui` is absent.
- Scoped to the 7 barrel blocks (`implementedBy` ending in a barrel index module + declared `exports`); non-barrel/renderer blocks logged un-coverable (#1164).

Outcome (matches the prediction): `npm run check:standards` runs **green (0 errors)**, surfacing the **3 genuine drift warnings** — `tabs` / `transient-component` / `view` (the #1165 targets) — plus the un-coverable note. 3 pure-rule unit tests in `we:scripts/__tests__/check-standards-rules.test.mjs`. The `EXPORT_SHAPE_ENFORCED` flip waits on #1164 (renderers) + #1165 (resolve the 3 drifts). Slice of #904.
