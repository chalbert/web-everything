---
type: idea
workItem: story
size: 8
status: resolved
parent: "315"
blockedBy: ["316"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: src/_data/benchmarkCapabilities.json
relatedReport: reports/2026-06-12-capability-extraction.md
tags: [gap-analysis, competitive-analysis, design-systems, ui-libraries, extraction, normalization, capability-matrix, research]
relatedProject: webdocs
crossRef: { url: /research/, label: "/research/ topic index" }
---

# Capability extraction — normalize each corpus source's components, docs & standards into one comparable schema

Phase 2 of the [gap-analysis program](/backlog/315-competitive-coverage-gap-analysis-program/): for every source in the benchmark corpus ([#316](/backlog/316-benchmark-corpus-design-systems-ui-libraries/)), enumerate its **components, documented patterns, and standards/guidelines** and ingest them **bottom-up into one normalized capability schema** — the internal pivot the analysis joins against. This is the lossy [adapter-as-normalization-hub](/backlog/315-competitive-coverage-gap-analysis-program/) pattern: each incumbent's idiosyncratic catalogue collapses into a common shape the platform never ships, and the *comparability that lossiness buys* is the entire value. The output is the matrix phase 3 (mapping & gap detection, the next child) reads — this story stops at "every source's surface is captured in one schema," not "gaps are found."

Blocked by #316 — there is no per-source extraction without a settled corpus + metadata schema to iterate over.

## Build

- **Define the capability schema first** — one row per external capability, carrying enough to map and dedup it later:
  - `id` (stable, de-vendored slug — `combobox`, `async-pagination`, `motion-reduction`), `label`, `kind` (`component` / `pattern` / `token` / `standard` — the gap-# precedent mixed all three; the `kind` field keeps them in one matrix without collapsing them), `sourceId` (→ corpus), `sourceName` for the capability *as that vendor names it*, `sourceUrl` (deep link to the component/pattern doc), `summary` (one line), `nativeAnchorHint` (a native API it plausibly maps to — `dialog`, `popover`, `<selectlist>`, anchor positioning — recorded now so phase 3's native-first weighing has input).
  - Borrow the platform's existing **intent / block / protocol / capability taxonomy** for `kind` rather than inventing one.
- **Extraction method, not just a dump.** Document *how* a source is read into the schema (which docs sections count, how a "component" vs. a "pattern" is decided, how variants/states roll up) so the **next run extracts the same way** — reproducibility is the program's requirement, and an undocumented method makes re-runs incomparable.
- **First full pass over the corpus** — populate the schema for every #316 source. De-duplicate *across sources* into shared capability ids (MD3's "Menu", Fluent's "Menu", Radix's "Dropdown Menu" → one `menu` capability with three `sourceName`s), so the matrix is capability-keyed, not source-keyed.
- **Store as a normalized data file** backing a `/research/` topic (the [#192](/backlog/192-longitudinal-research-freshness-system/) dated-revision model), with the session `reports/{date}we:-capability-extraction.md` linked via `relatedReport`. Keep the file diffable — a re-run should produce a clean diff of added/removed/changed capabilities, not a rewritten blob (the same mixed-escaping/splice discipline the other registries use).

## Acceptance

- A documented **capability schema** exists with a `kind` field spanning component / pattern / token / standard.
- A **first full extraction pass** covers every corpus source, capability-keyed with cross-source dedup (shared ids carry multiple `sourceName`s).
- The **extraction method is written down** well enough that a second pass over the same corpus produces a comparable matrix.
- Exposed as a `/research/` topic backed by a diffable data file; `npm run check:standards` green; not a hidden `reports/*.md`.
- Stops at extraction — it records `nativeAnchorHint` but does **not** label covered/missing (that is #347).

> Likely a split candidate: if the first pass sprawls, fan out per-source-batch extraction under #315 and keep this as the method + schema + reconciliation story.

**Graduated to** `we:src/_data/benchmarkCapabilities.json` — capability matrix + /research/benchmark-capabilities topic.
