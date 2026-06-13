---
type: issue
workItem: story
size: 8
parent: "315"
status: open
dateOpened: "2026-06-13"
tags: [gap-analysis, capability-extraction, benchmark, presence, fan-out]
blockedBy: ["352"]
---

# Exhaustive per-source capability presence + deep doc URLs (fan-out over the join table)

The exhaustive fill of the capability×source presence join table whose **foundation** #352 built ([src/_data/benchmarkCapabilityPresence.json](../src/_data/benchmarkCapabilityPresence.json)). #352 seeded the table from `benchmarkCapabilities.notableIn` (provenance `notable-inference`, no URL) and wrote the extraction method + validator. This item does the actual per-source web extraction — **one batchable slice per corpus source** (26 sources in `benchmarkCorpus.sources`, or small groups): walk each source's docs from its `docsUrl`, confirm presence for each of the 96 capabilities, and upgrade/insert rows to provenance `verified` with the deep doc URL and the vendor's `sourceName`. Genuinely a fan-out — **/slice this per source** before working; each source is an independent, diffable slice. Improves citation quality for the gap→backlog step (#348) and the diffability of re-runs.

## Method (from #352)

Per the `method` field in `benchmarkCapabilityPresence.json`: for source `S`, for each capability `C`, decide presence by the same kind tests the corpus uses (component/pattern/token/standard), and write `{ capabilityId: C, sourceId: S, present: true, provenance: "verified", sourceName: "<vendor's name>", url: "<deep doc link>" }`. A `notable-inference` seed row is upgraded **in place**. Never rewrite the whole file — splice rows so a re-run diffs cleanly. The `verified`-without-`url` warn-only check (#352) flags any slice that forgot the deep link.
