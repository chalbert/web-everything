---
type: idea
workItem: story
size: 5
parent: "1143"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# Split high-churn registries to per-entry files (prove path: researchTopics + intents)

Split the two highest-churn monolithic registries — we:src/_data/researchTopics.json (133 entries, very high churn from /prepare + /decision) and we:src/_data/intents.json (56 entries) — into per-entry files under we:src/_data/researchTopics/ and we:src/_data/intents/, each with a *.js loader that globs+aggregates (exact pattern already proven by we:src/_data/blocks/*.json + its loader, and backlog/*.md). Rendering/consumers stay unchanged (loader returns the same array). Kills the splice-only mixed-escaping footgun and converts 'everything serializes on this file' into 'disjoint entries merge clean'. Proves the loader + gate path before the rest (S3).

## Progress

Resolved. Both monoliths split into per-entry files; the assembled-array contract is byte-identical (round-trip deep-equal verified).

- **Node/Eleventy loaders** (the `we:scripts/lib/blocks-loader.cjs` pattern): `we:scripts/lib/intents-loader.cjs` + `we:scripts/lib/research-loader.cjs` (glob + id-sort), wired as the 11ty globals via `we:src/_data/intents.js` + `we:src/_data/researchTopics.js`. Per-entry files: `we:src/_data/intents/<id>.json` (56) + `we:src/_data/researchTopics/<id>.json` (133), 2-space JSON. Monoliths deleted.
- **All Node readers repointed** off the deleted files: `we:scripts/check-standards.mjs`, `we:scripts/check-app-conformance.mjs`, `we:scripts/gen-reference-index.mjs`, `we:scripts/gen-inventory.mjs` (this one was the trap — its `readJson` appends `.json`, so it silently read 0 until fixed), `we:scripts/normalize-graduated.mjs` (intent special-cased like block; the `we:src/_data/intents.json#<id>` graduatedTo anchor stays a stable virtual contract), `we:scripts/autofix/modelFixer.mjs` (Block+Research now per-id via `PER_ID_DIR`), `we:src/_data/demoBlockers.js`, and the two rule test-suites.
- **Vite/vitest TS consumers** (no precedent — blocks had none): a static default-import of the old `we:src/_data/intents.json` in `we:capabilities/index.ts` and a `require` in `we:webcases/__tests__/requirementValidator.test.ts`. Added `we:src/_data/intents.data.ts` — the bundler-side assembler using `import.meta.glob` (the analogue of the cjs loader; two assemblers exist by necessity — fs-glob for Node, `import.meta.glob` for the Vite bundle — both reading the same per-entry files).
- **Attribution fix (serves #1144/#1147):** extended `fileFor(kind,id)` in `we:scripts/check-standards-rules.mjs` so Intent/Research findings point at the per-entry file, not the deleted monolith — so `--scope`/`--local` lane attribution matches the file a lane actually dirties.

Verified: 255 script tests green (incl. pin-reference-snapshots); full gate clean over the changeset (only a foreign concurrent-session locus-prefix error remains, demoted under `--local`); live dev server renders all 56 intents + 133 research topics + per-entry detail pages (200). S3 (#1146) can now mechanically follow this exact path for protocols/demos/semantics/presets.
