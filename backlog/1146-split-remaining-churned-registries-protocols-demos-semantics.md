---
kind: story
size: 5
parent: "1143"
status: resolved
blockedBy: ["1145"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# Split remaining churned registries (protocols, demos, semantics, assemblerPresets)

After S2 (#1145) proves the loader+gate path, apply the same per-entry split to the remaining agent-churned monolithic registries: we:src/_data/protocols.json (32), we:src/_data/demos.json (31), we:src/_data/semantics.json (194), we:src/_data/assemblerPresets.json (~200). Same pattern: per-entry files + globbing *.js loader, consumers unchanged. Leave low-churn small singletons (adapters, capabilityMatrix, projects, chrome) as-is — splitting them buys negligible parallelism. blockedBy #1145 so the pattern is settled once.

## Progress

Resolved. All four split, assembled-array contract byte-identical (round-trip deep-equal verified per registry).

- **Loaders + 11ty globals** (the #1145 cjs pattern): a sibling `we:scripts/lib/protocols-loader.cjs` (and demos / semantics / presets variants) plus a `we:src/_data/protocols.js` 11ty data file (and demos / semantics / assemblerPresets variants). Per-entry files: `we:src/_data/protocols/<id>.json` (32), `we:src/_data/demos/<id>.json` (36), `we:src/_data/semantics/<slug>.json` (194), `we:src/_data/assemblerPresets/<name>.json` (6). Monoliths deleted.
- **Two shape wrinkles handled:** semantics keys on the human `term` (not an id), so files are named by a collision-free `termSlug(term)` — 194/194 unique — while the entry keeps its real `term`; assemblerPresets is an object wrapper `{presets:[…]}`, so `we:src/_data/assemblerPresets.js` re-wraps the loaded array to preserve the `.presets` consumer contract.
- **No Vite glob assembler needed** (unlike #1145): every consumer is node-side — scripts, vitest, and one Playwright spec (`we:plugs/__tests__/e2e/playgrounds.spec.ts`) — so all use the cjs loaders directly.
- **Consumers repointed:** `we:scripts/check-standards.mjs` (4 registries), `we:scripts/check-app-conformance.mjs` (protocols), `we:scripts/check-demos.mjs` (2× demos), `we:scripts/gen-inventory.mjs` (semantics — the same `readJson`-appends-`.json` trap as #1145), `we:scripts/normalize-graduated.mjs` (protocol+demo special-cased, anchors stay virtual), the two rule test-suites, and the requirementValidator + playgrounds specs.
- **Attribution (serves #1144/#1147):** extended `fileFor(kind,id)` so Protocol/Demo/Preset findings point at the per-entry file (validateProtocol + validatePreset routed through a local `file` alias).

Verified: full gate 0 errors (32 protocols, 194 terms, 36 demos, 6 presets); 273 vitest tests green (incl. pin-reference-snapshots + the TS consumer suites); live dev server renders 32 protocol anchors + 194 terms + the demos/semantics pages. Epic #1143's registry-split arc is complete; only #1147 (the orchestrator) remains.
