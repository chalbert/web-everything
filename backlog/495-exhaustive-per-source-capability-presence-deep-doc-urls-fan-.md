---
type: issue
workItem: epic
parent: "315"
status: open
dateOpened: "2026-06-13"
tags: [gap-analysis, capability-extraction, benchmark, presence, fan-out]
---

# Exhaustive per-source capability presence + deep doc URLs (fan-out over the join table)

**Umbrella epic for the per-source exhaustive fill** of the capability×source presence join table built
by **foundation** #352 ([benchmarkCapabilityPresence.json](../src/_data/benchmarkCapabilityPresence.json)).
#352 settled the extraction method, schema, and validator and seeded `notable-inference` rows; only the
per-source web extraction remains. **Sliced per corpus source (2026-06-13):** one `task` child per
`sourceId` in [benchmarkCorpus.sources](../src/_data/benchmarkCorpus.json) (26 sources). Each child walks
its source's `docsUrl`, confirms presence for the 96 capabilities, and **splices** rows to provenance
`verified` (deep doc URL + `sourceName`) — never rewriting the whole file, so re-runs diff cleanly.
Children are fully independent (disjoint `sourceId` rows) and immediately batchable; they raise citation
quality for the gap→backlog step (#348).

## Method (from #352)

Per the `method` field in `benchmarkCapabilityPresence.json`: for source `S`, for each capability `C`, decide presence by the same kind tests the corpus uses (component/pattern/token/standard), and write `{ capabilityId: C, sourceId: S, present: true, provenance: "verified", sourceName: "<vendor's name>", url: "<deep doc link>" }`. A `notable-inference` seed row is upgraded **in place**. Never rewrite the whole file — splice rows so a re-run diffs cleanly. The `verified`-without-`url` warn-only check (#352) flags any slice that forgot the deep link.
