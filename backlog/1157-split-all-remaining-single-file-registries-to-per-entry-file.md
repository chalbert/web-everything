---
type: issue
workItem: story
size: 8
status: open
parent: "1143"
dateOpened: "2026-06-19"
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
