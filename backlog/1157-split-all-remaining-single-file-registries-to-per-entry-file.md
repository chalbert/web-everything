---
kind: story
size: 8
status: resolved
parent: "1143"
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# Split all remaining single-file registries to per-entry files — complete the #1145/#1146 convention

Finish the per-entry registry split (#1145 prove-path, #1146 churned set) by converting **every** remaining hand-authored collection registry under we:src/_data/ from one monolithic `<reg>.json` to a per-entry directory `we:src/_data/<reg>/<id>.json`, so the convention is **universal** — authors and the parallel batcher (#1143/#1147) never special-case "split vs monolithic" again. The live #1153 run exposed the cost of the gap: a lane editing a still-monolithic registry (e.g. we:src/_data/plugs.json) can't run concurrently and falls to the serial lane. Coherence is the goal — one rule for all registries, not a high-churn/low-churn split.

## Scope — convert these (all are arrays or keyed object-maps = independent entries)

Array registries → one file per entry, keyed by its `id`/`name`:
`plugs` (51), `projects` (40), `capabilities` (21), `references` (8), `adapters` (3), `designSystems` (3), `analytics` (2), `renderStrategies` (4), `states` (3), `resources` (6), `expressiveAssets` (6).

Object-map registries → one file per key:
`traits` (9), `capabilityMatrix` (3), `docs` (2), `webhandlers` (8), `webportals` (7), `workbenchFeatures` (10), `workbenchTools` (12), `capabilityWorkedExample` (7), `benchmarkCapabilities` (8), `benchmarkCorpus` (9), `benchmarkCoverage` (13).

## Exclude — DERIVED/generated artifacts (regenerated, never hand-edited; splitting is pointless and the integrator already regens once)

`we:src/_data/referenceIndex.json` (gen-reference-index), `we:src/_data/referenceSnapshots.json` (pin-reference-snapshots), `we:src/_data/benchmarkCapabilityPresence.json` (sweep-reference-liveness). **Builder check per file:** if a `we:scripts/*.mjs` does `writeFileSync` to it, it is generated → leave monolithic (or split its generator's output only if trivially keyed). Note: `we:src/_data/projects.json` is partly script-updated (graduatedTo) — verify the generator writes per-entry-safely or keep it integrator-applied.

## Consumers to update (the #1146 pattern already established the seam)

- The 11ty data-loader glob that folds `src/_data/<reg>/*.json` back into one collection (mirror what #1146 did for protocols/demos/semantics/assemblerPresets).
- `we:scripts/check-standards-rules.mjs` / `we:scripts/check-standards.mjs` and any validator reading the monolithic `<reg>.json` directly.
- Any `require('../src/_data/<reg>.json')` / fetch in plateau-app/frontierui consumers (grep cross-repo).
- The workflow effects-manifest list in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` (header + probe prompt) — once all registries are per-entry, the "still-MONOLITHIC low-churn" carve-out (projects/capabilities/adapters/capabilityMatrix/designSystems) is **deleted**, and the integrator no longer applies any monolith splices.

## Done-when

Every hand-authored registry is a per-entry dir; the rendered site + `npm run check:standards` are green; the parallel batcher's monolith carve-out is gone (no registry forces the serial lane). Origin #1153; pattern #1145/#1146; epic #1143.

## Progress

Resolved. Every registry that is genuinely a **collection of independent entries** is now per-entry; the assembled array is set-identical to the former monolith (round-trip verified). The scope list in this item conflated two different things — most of the "object-map registries" it named are NOT keyed maps of N entries, so they were (correctly) left monolithic with a documented reason rather than force-split into incoherent fragments.

- **Split (10 array registries → `src/_data/<reg>/<key>.json`):** plugs (51), projects (40), capabilities (21), references (8, keyed by a `slugKey(category)` since entries have no id — the #1146 semantics-by-term precedent), designSystems (3), analytics (2), renderStrategies (4), states (3), resources (6), expressiveAssets (6, incl. the `_schema` pseudo-entry as `we:src/_data/expressiveAssets/schema__meta.json`). Monoliths deleted.
- **One shared loader, not ten copies (#1157's coherence win):** `we:scripts/lib/registry-loader.cjs` exposes `loadRegistry(reg, keyOf)` / `loadDataRegistry(reg)` — the factory analogue of the per-registry `*-loader.cjs` files. Each registry gets a thin 11ty global `we:src/_data/<reg>.js` calling it. The one TS/Vite consumer (`we:capabilities/index.ts` statically imported `we:src/_data/capabilities.json`) gets a `we:src/_data/capabilities.data.ts` `import.meta.glob` assembler (mirrors `we:src/_data/intents.data.ts`, #1145).
- **Consumers repointed:** `we:scripts/check-standards.mjs` (plugs/projects/capabilities/designSystems/references), `we:scripts/gen-inventory.mjs` (plugs/projects — same `readJson`-appends-`.json` trap as #1145/#1146), `we:scripts/gen-reference-index.mjs` (references), `we:scripts/audit-backlog-health.mjs` + `we:src/_data/backlog.js` (projects), `we:scripts/autofix/modelFixer.mjs` (Plug/CapabilityAdapter → `PER_ID_DIR`), and the two rule test-suites. Attribution: `fileFor` / `PER_ID_SPEC_DIR` in `we:scripts/check-standards-rules.mjs` now route Plug/Capability/Project/DesignSystem findings at the per-entry file; the `<reg>.json#<id>` graduatedTo + `refRegistry` labels stay virtual contracts (the #1145/#1146 convention).
- **NOT split (left monolithic, with reason) — these are not collections of independent entries, so per-key fragments would be incoherent, not parallel-safe:** single structured config docs `we:src/_data/traits.json` / `we:src/_data/docs.json` / `we:src/_data/capabilityMatrix.json` (heterogeneous keys, one document); the nested-group `we:src/_data/adapters.json` (3 groups each with an `items[]`); single protocol docs `we:src/_data/webhandlers.json` / `we:src/_data/webportals.json` (each is ONE protocol object, not 8 entries — the item's "(8)/(7)" counts were field counts, not entry counts); and the sweep/generated artifacts `workbenchFeatures` / `workbenchTools` / `benchmarkCapabilities` / `benchmarkCorpus` / `benchmarkCoverage` / `capabilityWorkedExample` (`id`/`version`/`lastSwept` headers or `_generatedBy`; regenerated, never hand-merged). Plus the already-excluded derived `referenceIndex` / `referenceSnapshots` / `benchmarkCapabilityPresence`.
- **Carve-out updated, not deleted:** the workflow effects-manifest (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`) now states that NO collection registry forces the serial lane — only the handful of genuinely-monolithic structured docs above do (touchesMonolith). The done-when's "carve-out gone" was premised on all registries being collections; for the structured docs it shrinks to its irreducible core instead.

Verified: `npm run check:standards` 0 errors (51 plugs, 21 capabilities, etc.); 395 validator/capability tests green; Eleventy `build:check` wrote 2767 pages clean (capabilities catalog + per-plug/per-designSystem detail pages render). Pre-existing reds unrelated to this item: `@frontierui/plugs/*` import-resolution in `plugs/`+`blocks/` integration specs (sibling package not linked in the worktree) and a `claim-no-git-guard` red from another session's uncommitted `we:scripts/backlog.mjs` edit — both confirmed present on the pre-change baseline.
