---
kind: story
size: 3
parent: "583"
blockedBy: []
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "scripts/gen-reference-index.mjs + src/_data/referenceIndex.json (npm run gen:reference-index)"
relatedProject: webdocs
relatedReport: reports/2026-06-14-backlog-split-analysis.md
tags: [monitoring, references, registry, substrate, link-rot]
---

# Reference-registry substrate — index the structured reference homes

Build the single index of every external reference the project cites — the foundation epic
[#583](/backlog/583-external-reference-health-monitoring-liveness-retirement-rep/) calls "likely the
first slice to build," carved out of [#585](/backlog/585-reference-liveness-detection-sweep-multi-modal-404-moved-arc/)
(the liveness sweep) so the prerequisite is its own batchable item rather than buried scope. The sweep
(#585) fetches what this index lists; the retirement convention ([#584](/backlog/584-general-reference-retirement-convention-generalize-the-corpu/))
applies to its rows. **Foundational — no real blocker; build first.**

## Scope: the five STRUCTURED homes (deterministic JSON walks)

A reference-surface investigation (2026-06-14, in the split report) found references scattered across
heterogeneous homes. This slice indexes only the five that are machine-readable, where extraction is a
deterministic walk with no judgement:

| Home | File | Field(s) | ~URLs |
|---|---|---|---|
| Corpus sources | `we:src/_data/benchmarkCorpus.json` (sources) | `docsUrl`, `repoUrl` | 51 |
| Design reference library | `we:src/_data/references.json` | `links[].url` | 28 ext |
| Web-standard refs | `fui:src/_data/blocks.json` | `webStandards.*.reference` | 94 |
| Capability-presence rows | `we:src/_data/benchmarkCapabilityPresence.json` | `rows[].url` | 1,266 |
| Intent docs | `we:src/_data/intents.json` | URLs in HTML `description` | 70 |

Emit **one deduped index** `{ url, home, sourceId, label }` (a generated `src/_data/*` data file +
the extractor under `scripts/`). Dedup by canonical URL — the same `docsUrl` recurs across corpus,
we:references.json, and capability-presence rows. Demoable state: a count-by-home render / the generated
index file.

## Explicitly out of scope (keeps this fork-free at size 3)

- **Freeform homes** — `reports/*.md` (~550 links, lossy markdown), `we:researchTopics.json` (prose, 0
  structured URLs). A markdown-citation parser is a separate, lossy concern — file as a follow-on slice
  if the dogfood proves it's needed.
- **Internal-only refs** — `backlog/*.md` `crossRef` (263, all internal `/backlog`·`/research` paths)
  and `we:adapters.json`/`we:protocols.json` (no URLs). Not external references; nothing to monitor.
- **Liveness fetching** (#585's job) and **the retirement-shape convention** (#584's decision). This
  slice only *indexes* — it doesn't fetch or classify.

No buried fork: the index schema and canonical-URL dedup are mechanical; the heterogeneous-home
retirement shape is #584's decision, not this build's.

## Progress

- **Resolved 2026-06-14.** Built `we:scripts/gen-reference-index.mjs` (`npm run gen:reference-index`) —
  a deterministic walk of the five structured homes that emits the deduped index to
  `we:src/_data/referenceIndex.json`. **1182 unique URLs from 1460 occurrences** (corpus 51, references
  28, blocks 93, capability 1266, intents 22 — matching the scope table). Dedup is by canonical URL
  (lowercase proto/host, strip trailing slash; query + fragment kept so deep-link demos stay
  distinct); each row is `{ url, home, sourceId, label, homes[], occurrences }` — `homes[]` records
  every home a URL appears in (e.g. Carbon → corpus + references), keeping provenance lossless. The
  file carries a `summary.byHome` count block (the count-by-home demoable render) and **no timestamp**,
  so it's a no-op diff on re-run (verified idempotent). Freeform/internal homes left out of scope per
  the body; liveness (#585) and retirement shape (#584) remain their own slices.
