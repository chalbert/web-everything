---
kind: epic
parent: "315"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: [gap-analysis, capability-extraction, benchmark, presence, fan-out]
---

# Exhaustive per-source capability presence + deep doc URLs (fan-out over the join table)

**Umbrella epic for the per-source exhaustive fill** of the capability×source presence join table built
by **foundation** #352 ([we:benchmarkCapabilityPresence.json](../src/_data/benchmarkCapabilityPresence.json)).
#352 settled the extraction method, schema, and validator and seeded `notable-inference` rows; only the
per-source web extraction remains. **Sliced per corpus source (2026-06-13):** one `task` child per
`sourceId` in [benchmarkCorpus.sources](../src/_data/benchmarkCorpus.json) (26 sources). Each child walks
its source's `docsUrl`, confirms presence for the 96 capabilities, and **splices** rows to provenance
`verified` (deep doc URL + `sourceName`) — never rewriting the whole file, so re-runs diff cleanly.
Children are fully independent (disjoint `sourceId` rows) and immediately batchable; they raise citation
quality for the gap→backlog step (#348).

## Method (from #352)

Per the `method` field in `we:benchmarkCapabilityPresence.json`: for source `S`, for each capability `C`, decide presence by the same kind tests the corpus uses (component/pattern/token/standard), and write `{ capabilityId: C, sourceId: S, present: true, provenance: "verified", sourceName: "<vendor's name>", url: "<deep doc link>" }`. A `notable-inference` seed row is upgraded **in place**. Never rewrite the whole file — splice rows so a re-run diffs cleanly. The `verified`-without-`url` warn-only check (#352) flags any slice that forgot the deep link.

## Retired sources are excluded from the fan-out

A source marked `retired: true` in [we:benchmarkCorpus.json](../src/_data/benchmarkCorpus.json) is **not**
a fillable slice — there is nothing live to walk. The `fast` slice ([#531](/backlog/531-verify-capability-presence-fast-fast/)
found the docs decommissioned; retired via [#546](/backlog/546-corpus-source-fast-has-a-dead-docsurl-fast-docs-decommission/))
is the first such case: it carries 0 presence rows and FAST's former coverage is already represented by
`fluent-2`. So the fan-out is over the corpus's **non-retired** sources. The general convention for
detecting and retiring dead sources/references is being lifted out of this epic into the **external
reference health monitoring** epic.

## Resolution (2026-06-14)

All 26 source slices are closed: 25 non-retired sources filled + `fast` (#531) confirmed retired (#546).
The join table [we:benchmarkCapabilityPresence.json](../src/_data/benchmarkCapabilityPresence.json) now
carries **1266 `verified` rows** across 25 sources, **0 `verified`-without-`url`** (every verified row
has a deep doc link + `sourceName`), and **13 residual `notable-inference` rows** the slices could not
upgrade to verified from the live docs (primer ×2, react-aria ×4, fluent-2 ×2, material-3 ×4, carbon ×1) —
these stay as honest inference rather than being forced to verified. The per-source fan-out is complete;
citation quality is now in place for the gap→backlog step (#348). `graduatedTo: none` — this epic filled
the existing data file built by foundation #352; it spawned no new entity.
