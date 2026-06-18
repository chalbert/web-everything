---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
preparedDate: "2026-06-17"
relatedReport: reports/2026-06-17-blocks-json-per-file-split.md
tags: [blocks, blocks-json, architecture, 11ty, data-loader, concurrency]
relatedProject: webdocs
crossRef: { url: /backlog/657-formalize-the-blocks-json-block-protocol-shape-cem-aligned-r/, label: "#657 pinned the field set, not file granularity" }
---

# Split the monolithic fui:blocks.json into one file per block spec (assemble via a _data loader)

## Ruling — ratified 2026-06-17

**Fork 1 → A** (per-file specs, assembled by a `we:src/_data/blocks.js` glob loader). **Fork 2 → B1** (flat `src/_data/blocks/<id>.json`; the per-block `block-descriptions/<id>.njk` stays in `_includes/`).

Decided on merit, with two grounding corrections to the prepared plan landed during ratification:
- **Fork 2's load-bearing reason is the standards-repo seam, not reversibility.** The block structural spec is *registry/contract* data — a peer of `we:intents.json`/`we:adapters.json`/`we:protocols.json`/`we:traits.json`, all flat in `src/_data/`. B1 keeps the contract in the standard's data layer (consistent with every other registry); the description njk is docs and stays on the `_includes/` rail. B2 (co-located `blocks/<id>/{spec,description}`) would pull the njk off its native 11ty include rail and make blocks the lone contract scattered out of the data layer. #880's "one locus" is already satisfied by `_data/blocks/<id>.json` (a unique path); co-location isn't required. B2 stays a cheap future option. The "harder to reverse" point is *prioritization*, not the fork verdict (a fork rules the best end-state; cost/sequencing is decided separately) — it was dropped.
- **No 11ty key collision (empirically verified on the repo's pinned Eleventy v2.0.1).** A `we:src/_data/blocks.js` array loader + sibling `src/_data/blocks/<id>.json` files → `blocks` resolves to the loader's array; the directory's auto-nested data does not collide. So the literally-ratified B1 path works as-is — no need to move specs outside `_data/`. (The earlier collision worry was disproven by the test, not assumed.)
- **Purely internal.** Both forks are source-organization only; the *contract* (#657 field set, the assembled `blocks` array shape) is identical either way. No `@webeverything` artifact / protocol / conformance vector changes.

Repoint set is wider than the prepared plan: the 4 direct-read scripts **plus** `we:scripts/autofix/modelFixer.mjs` (entity→registry map) and 4 tests that read the real file. The autofix *engine* tests use synthetic array fixtures and are unaffected.

The block structural contract lives in one 4657-line `fui:src/_data/blocks.json` (75 blocks), while every other per-item surface is one-file-per-item: behavioral specs are already per-block (`src/_includes/block-descriptions/*.njk`, 80 files), and the 866-item backlog has no `we:backlog.json` — it globs `backlog/*.md` via `we:src/_data/backlog.js` (one of 12 `_data/*.js` loaders). The monolith is the lone holdout and it hurts: every block edit collides on one file (the concurrent-edit conflict the backlog dodged by going per-file), diffs lose locality, and the structural half is inconsistent with its already-per-block behavioral half. Decide (1) keep the monolith vs split to per-file specs assembled by a `we:src/_data/blocks.js` glob loader, and (2) the file layout. #657 pinned the field set but not file granularity — an open gap, not a re-litigation. Orthogonal to #841.

## Grounding digest

Verified against the real tree (2026-06-17); full survey in [`we:reports/2026-06-17-blocks-json-per-file-split.md`](../reports/2026-06-17-blocks-json-per-file-split.md), research topic [`blocks-json-per-file-granularity`](/research/blocks-json-per-file-granularity/).

- **Per-file is already the repo norm; `fui:blocks.json` is the holdout.** The backlog globs `backlog/*.md` with no `we:backlog.json` ([`we:src/_data/backlog.js:175-178`](../src/_data/backlog.js)); the repo runs **12** `_data/*.js` glob loaders (`we:backlog.js`, `we:cases.js`, `we:burndown.js`, `we:designRefs.js`, …). The block *behavioral* half is already per-block (`src/_includes/block-descriptions/<id>.njk`, 80 files). Only the structural contract didn't follow.
- **The assembled `blocks` array is consumed two ways.** (1) As the 11ty `blocks` `_data` global — every template/loader-fed validator reads the **array** (`we:src/blocks.njk`, `we:src/block-pages.njk`, `we:src/index.njk`, `we:src/presets.njk`, …), so a `we:blocks.js` loader emitting the same array shape leaves them **untouched**. (2) By **direct file read** in standalone scripts that need the glob: [`we:scripts/gen-cem.mjs:37`](../scripts/gen-cem.mjs) (the only hard `readFileSync`), [`we:scripts/check-standards.mjs:91`](../scripts/check-standards.mjs) (+ dup-id check `:209`), [`we:scripts/check-app-conformance.mjs:45`](../scripts/check-app-conformance.mjs), [`we:scripts/gen-reference-index.mjs:34`](../scripts/gen-reference-index.mjs).
- **Wrinkle 1 — autofix write-target.** [`we:scripts/check-standards-rules.mjs:572`](../scripts/check-standards-rules.mjs) (`FILE.Block = 'fui:src/_data/blocks.json'`) and `:92` (`buildGraduatedKinds` → `block.file = 'fui:blocks.json'`) are the descriptor `file` pointers the autofix engine ([`we:scripts/autofix/engine.mjs`](../scripts/autofix/engine.mjs)) **writes** when patching a block's status. After the split they must resolve **per-block** (`_data/blocks/<id>.json`) so a fixer patches the right small file — net-positive (tiny diff, not the monolith) but a required repoint.
- **Wrinkle 2 — `graduatedTo` anchor grammar.** [`we:scripts/normalize-graduated.mjs:39`](../scripts/normalize-graduated.mjs) (`['block','fui:blocks.json']`) and the `FILE_ANCHOR` regex at `:75` define the canonical `fui:blocks.json#<id>` anchor used across the backlog's `graduatedTo` fields — a **stable cross-backlog contract**. After the split, `fui:blocks.json#<id>` must keep resolving as a **virtual** anchor (grammar stays, physical file goes) or every `graduatedTo` value migrates. Keep the virtual anchor.
- **External precedent confirms the direction (survey reshaped confidence, not the forks).** **Nx migrated *away* from the monolith for #882's exact #1 driver** — its `15-7-0-split-configuration-into-project-json-files` migration deletes the workspace-wide `we:angular.json`/`we:workspace.json` and replaces it with per-project `we:project.json` files, explicitly because the monolith "can be a source of **merge conflicts**" for large workspaces; the consumed artifact (Nx's resolved project graph) is *computed* from the per-file inputs, exactly like the `blocks` array. **Style Dictionary** globs + deep-merges many token files into one dictionary — and the merge is **order-dependent** ("later files take precedence"), so the loader **must impose a deterministic sort** (by `id`), not trust `readdirSync` order. **custom-elements-manifest** aggregates per package — but only because it is *generated*; aggregation is fine for a build artifact, not for a hand-edited source of truth like `fui:blocks.json`.

## The evidence — per-file is already the repo norm

| Surface | Granularity | Assembled by |
|---|---|---|
| Backlog (866 items) | one `backlog/<NNN-slug>.md` per item, **no `we:backlog.json`** | `we:src/_data/backlog.js` (glob loader) |
| Block behavioral specs (80) | one `src/_includes/block-descriptions/<id>.njk` per block | 11ty include per block |
| Block **structural** contract (75) | **one 4657-line `fui:src/_data/blocks.json`** | — (monolith) |

## Recommended path at a glance

| Fork | Question | Options | Recommended default | Confidence |
| --- | --- | --- | --- | --- |
| 1 | Granularity | A per-file + `we:blocks.js` loader · B keep monolith | **A — per-file, assembled by `we:src/_data/blocks.js`** | ~88% |
| 2 | File layout (decide with A) | B1 flat `_data/blocks/<id>.json` · B2 co-located `blocks/<id>/{spec,description}` | **B1 — flat `src/_data/blocks/<id>.json`** | ~70% |

Supported by default (not forks): the **assembled-array contract is preserved** (the loader emits the exact `blocks` array shape templates + scripts consume today — forced, since 11ty would otherwise expose `_data/blocks/` as nested data); **deterministic assembly** (sort by `id` so the array is stable regardless of `readdirSync` order — forced by Style Dictionary's merge-order lesson); **cross-block validation stays on the assembled array** (unique `id`, intent refs, preset `composesBlocks` at [`we:check-standards-rules.mjs:663-664`](../scripts/check-standards-rules.mjs) — unchanged); the **`fui:blocks.json#<id>` virtual anchor** survives the file's deletion (wrinkle 2).

## Fork 1 — granularity: per-file vs the monolith (the core call)

*Fork-existence (case b, genuine either/or): the contract is authored either as one aggregate file **xor** as N per-block files — both produce the same assembled `blocks` collection, but the source of truth can only be one shape; you can't hand-author the same spec in both. Neither branch is broken (the monolith works today), so it's a real default-posture call, not a forced invariant.*

- **A (bold default) — per-file block specs, assembled by a `we:src/_data/blocks.js` loader.** One file per block; the loader globs them into the same `blocks` array templates + scripts consume today, mirroring `we:backlog.js` exactly. **Wins:** (1) **concurrent-edit conflicts vanish** — the #1 driver; one big JSON means every block edit collides, the same hazard the backlog dodged by dropping `we:backlog.json` and the reason `we:intents.json`/`we:adapters.json` are spliced-not-rewritten; (2) **diff/locus locality** — a one-block change is a small clean diff with an unambiguous path (feeds #880); (3) **consistency** — the structural spec sits beside its already-per-block `block-descriptions/<id>.njk`; (4) **scale** — 75 → growing. **External backing:** Nx made the identical monolith→per-file call for the identical merge-conflict reason. **Cost:** the migration + the two wrinkles (autofix write-target, anchor grammar), all mechanical.
- **B — keep the monolith.** *Con:* the conflict/diff/scale costs above; inconsistent with every other per-item surface; out of step with the external precedent (Nx, Storybook CSF). *Pro:* zero migration, trivially atomic cross-block ops — but those ops are equally easy on the assembled array, so the pro is thin.

Recommendation: **A**, confidence **~88%** (raised from ~85% by the Nx precedent). Residual is purely the layout sub-choice (Fork 2) + the one-time migration cost; the direction is strongly precedented both in-repo (the backlog proved it here) and externally (Nx). *Red-team note for the deciding turn:* the attack on A is "the monolith makes cross-block ops atomic and avoids a migration." The rebuttal grounded in the tree: every reader already consumes the *assembled array*, not the file, so cross-block ops keep their atomicity on the array; the migration is scripted/deterministic; and the conflict cost the monolith imposes is paid on *every* edit, forever, vs a one-time move.

## Fork 2 — file layout (secondary; resolve with Fork 1·A)

*Fork-existence (case b, genuine either/or): flat-in-`_data` vs co-located-bundle are mutually-exclusive on-disk homes — a block's spec lives in exactly one place; B1 and B2 can't both be the canonical layout. Both are coherent, so it's a real call, not a forced invariant.*

- **B1 (bold default) — flat `src/_data/blocks/<id>.json`**, with the existing per-block njk staying in `block-descriptions/`. Minimal move; the loader globs `_data/blocks/*.json`. (The loader is named to *replace* 11ty's auto-exposed `_data/blocks/` nested data and emit the array shape templates expect.) **Smallest, reversible toward B2 later.**
- **B2 — co-located `src/blocks/<id>/{we:spec.json, we:description.njk}`** — the full per-block bundle in one dir, structural + behavioral together. Cleaner ownership, but a much larger move (relocates 80 njk files + retargets the include resolution).

Recommendation: **B1**, confidence **~70%**. B2 is the cleaner-ownership end-state, but it's a bigger, harder-to-reverse move whose payoff (co-location) is incremental over B1; B1 is reversible *toward* B2, so taking B1 first is the low-regret order. Residual is purely whether the team wants the bundle now vs later — cheap to defer.

## Migration plan (on ratify A + B1)

- Write `we:src/_data/blocks.js` (copy `we:src/_data/backlog.js`'s glob pattern) → assembles the `blocks` array, **sorted by `id`** for determinism, preserving the shape readers expect.
- Split `fui:blocks.json` → per-block `src/_data/blocks/<id>.json` files (scripted, deterministic).
- Repoint the direct-read scripts: `we:gen-cem.mjs:37` (the hard `readFileSync` → the glob/shared loader), and confirm `we:check-standards.mjs`, `we:check-app-conformance.mjs`, `we:gen-reference-index.mjs` route through the assembled `blocks` (most already do).
- **Wrinkle 1 — autofix:** point `FILE.Block` / `buildGraduatedKinds` `block.file` ([`we:check-standards-rules.mjs:572,92`](../scripts/check-standards-rules.mjs)) at the per-block path so a status fixer patches `_data/blocks/<id>.json`.
- **Wrinkle 2 — anchors:** keep `fui:blocks.json#<id>` resolving as a virtual/canonical anchor in `we:normalize-graduated.mjs` (REG_SPEC + `FILE_ANCHOR`) so existing `graduatedTo` references don't break.
- Keep cross-block validation (unique `id`, intent refs, preset `composesBlocks`) operating on the assembled array.
- Delete `fui:blocks.json` only after the gate is green on the assembled collection.
