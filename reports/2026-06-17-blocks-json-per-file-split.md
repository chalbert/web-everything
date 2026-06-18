# Prep research — split the monolithic `fui:blocks.json` into one file per block spec (decision #882)

**Date:** 2026-06-17 · **Item:** [#882](/backlog/882-split-the-monolithic-blocks-json-into-one-file-per-block-spe/) ·
**Status:** prepared (forks at DoR, call deferred to `/next decision`) · **Research topic:**
`blocks-json-per-file-granularity`

## The question

The block **structural** contract lives in one 4657-line `fui:src/_data/blocks.json` (75 blocks). Every other
per-item surface in the repo is one-file-per-item — the 866-item backlog globs `backlog/*.md` (no
`we:backlog.json`), and the block *behavioral* specs are already per-block (`src/_includes/block-descriptions/*.njk`,
80 files). The monolith is the lone holdout. Should it stay a monolith, or split to per-file specs assembled by a
`we:src/_data/blocks.js` glob loader (the exact pattern `we:backlog.js` already uses)? And if it splits, what file
layout?

This is a decision that **ratifies a shipped internal pattern** (the glob-and-assemble loader already exists 12×
in this repo), so the survey is light on browser standards and heavy on (a) the concrete reader inventory in the
real tree and (b) how comparable tooling ecosystems made the same monolith→per-file call.

## Reader/writer inventory — who touches `fui:blocks.json` today

Two consumption modes:

1. **As an 11ty `_data` collection** — `fui:src/_data/blocks.json` is auto-loaded by 11ty as the `blocks` global,
   and **every template/script that reads the assembled array** (`we:src/blocks.njk`, `we:src/block-pages.njk`,
   `we:src/index.njk`, `we:src/presets.njk`, … and the loader-fed validators) consumes the *array*, not the file. A
   `we:blocks.js` glob loader that emits the **same array shape** leaves all of these untouched.
2. **By direct file read** in standalone scripts — these need the glob (or a shared loader):
   - `we:scripts/gen-cem.mjs:37` — `JSON.parse(readFileSync(join(DATA,'fui:blocks.json')))` (the only hard `readFileSync`).
   - `we:scripts/check-standards.mjs:91` — `readJson('fui:blocks.json')`, dup-id check at `:209`.
   - `we:scripts/check-app-conformance.mjs:45` — `readJson('fui:src/_data/blocks.json', [])`.
   - `we:scripts/gen-reference-index.mjs:34` — `blocks: 'fui:blocks.json'`.

Two **wrinkles** the original migration plan didn't name — both real, both surfaced by reading the tree:

- **autofix write-target.** `we:scripts/check-standards-rules.mjs:572` (`FILE.Block = 'fui:src/_data/blocks.json'`) and
  `:92` (`buildGraduatedKinds` → `block.file = 'fui:blocks.json'`) are the descriptor `file` pointers the autofix
  engine (`we:scripts/autofix/engine.mjs`) **writes** to when it patches a block's status. Splitting means these
  pointers must resolve **per-block** (`_data/blocks/<id>.json`) so a fixer patches the right small file. This is
  net-positive (a fixer rewrites a tiny file, not the 4657-line monolith), but it is a required repoint, not a
  no-op.
- **`graduatedTo` anchor grammar.** `we:scripts/normalize-graduated.mjs:39` (`['block','fui:blocks.json']`) and the
  `FILE_ANCHOR = /^([a-z]+\.json)#.../` regex at `:75` define the canonical `fui:blocks.json#<id>` anchor used across
  the backlog's `graduatedTo` fields. That anchor string is a **stable cross-backlog contract**. After the split,
  `fui:blocks.json#<id>` must keep resolving (as a virtual/canonical anchor) — i.e. the grammar stays, the physical
  file does not — or every `graduatedTo: …fui:blocks.json#x` value must be migrated. Keeping the virtual anchor is
  far cheaper and preserves backward-compatible references.

## External prior art — comparable monolith→per-file calls

The survey was on tooling that stores per-component / per-project structured config, not on browser standards
(this isn't a greenfield standard). Two precedents are directly on-point:

- **Nx — migrated *away* from the monolith for this exact reason.** Nx historically held all project config in a
  single workspace-wide `we:angular.json` / `we:workspace.json`. It shipped a migration
  (`15-7-0-split-configuration-into-project-json-files`) that **deletes the monolith and replaces it with
  per-project `we:project.json` files**, explicitly because "for medium to large workspaces these can be a source of
  **merge conflicts**" and per-file config gives "less possibility of merge conflicts for larger workspaces." The
  consumed artifact (Nx's resolved project graph) is *computed* from the per-file inputs — exactly the
  `blocks` assembled array in #882. This is the strongest precedent: a major ecosystem made the identical call
  (#882's #1 driver — concurrent-edit conflicts — is Nx's stated driver) and chose per-file.
  ([nx.dev project config](https://nx.dev/configuration/projectjson),
  [Nx 12.5 per-project config](https://blog.nrwl.io/per-project-configuration-storybook-support-for-angular-12-auto-refresh-for-dependency-graph-and-bcd2d1e06658))
- **Style Dictionary — glob-and-deep-merge is the norm.** Style Dictionary takes an **array of file-path globs**
  (`tokens/**/*.json`) and **deep-merges** them into one dictionary; "you can split up the design token files
  however you want." Two load-bearing details for #882: (1) the directory/file structure has **no effect** on the
  consumed object — file layout is decoupled from the assembled shape (validates that a `we:blocks.js` loader can
  emit the array templates expect regardless of layout), and (2) the merge is **order-dependent** ("later files
  take precedence"), so a glob loader **must impose a deterministic sort** rather than trust `readdirSync` order.
  ([Style Dictionary config](https://styledictionary.com/info/tokens/),
  [GitHub](https://github.com/style-dictionary/style-dictionary))

Adjacent confirmations: Storybook **CSF** is one story file per component; **custom-elements-manifest** aggregates
to one `we:custom-elements.json` per package but only because it is **generated**, not hand-authored — i.e.
aggregation is acceptable for a build artifact, not for a hand-edited source of truth (which `fui:blocks.json` is).

**Did the survey reshape the forks?** It did not add or dissolve a fork (the direction was already strongly
internally precedented), but it (a) hardened the default with an external migration precedent that made the
identical call for the identical reason (Nx), (b) added a **determinism** requirement to the loader (Style
Dictionary's merge-order caveat), and (c) the tree-read surfaced two migration constraints (autofix write-target,
anchor-grammar stability) absent from the original plan.

## Per-fork classification

- **Layer.** This is a **webdocs build/authoring-surface** concern, internal to the WE repo's 11ty data
  pipeline. It mints **no protocol and no intent** — #657 already pinned the field set (the *contract*); #882 is
  purely **file granularity** of how that contract is authored. Nothing crosses the WE→FUI seam. So no
  protocol/intent classification applies; it's a docs-pipeline implementation detail.
- **Fixed mechanic or dimension?** Granularity is a **fixed mechanic** (one repo-wide posture), not a per-block
  configurable axis — every block authors the same way. Same for layout.
- **Separation bias.** The standing bias (separate/decouple, burden on combining) points at **per-file**: the
  monolith *combines* 75 independent specs into one file; the burden is on keeping them combined, and the only
  pro of combining (atomic cross-block ops) is equally served by the assembled array.

## Recommendation handed to #882

- **Fork 1 (granularity): A — per-file, assembled by `we:src/_data/blocks.js`.** Confidence ~88% (was ~85%; the Nx
  precedent raised it). Residual is the migration cost + the two wrinkles above, all mechanical.
- **Fork 2 (layout): B1 — flat `src/_data/blocks/<id>.json`.** Confidence ~70%. Smaller, reversible-toward-B2
  move; B2 (co-located `blocks/<id>/{we:spec.json,we:description.njk}`) is the cleaner-ownership end-state but a much
  larger move (relocates 80 njk + retargets include resolution) — defer it as a separate call.

Full forks, options, and migration plan live in the backlog item.

## Sources

- [Nx — Project Configuration (we:project.json)](https://nx.dev/configuration/projectjson)
- [Nx 12.5 — Per-project configuration](https://blog.nrwl.io/per-project-configuration-storybook-support-for-angular-12-auto-refresh-for-dependency-graph-and-bcd2d1e06658)
- [Splitting we:nx.json and we:angular.json per project — nrwl/nx#2643](https://github.com/nrwl/nx/issues/2643)
- [Style Dictionary — Design Tokens / multiple sources](https://styledictionary.com/info/tokens/)
- [style-dictionary/style-dictionary (GitHub)](https://github.com/style-dictionary/style-dictionary)
