---
type: idea
workItem: story
size: 3
parent: "583"
blockedBy: []
status: open
dateOpened: "2026-06-14"
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
| Corpus sources | `src/_data/benchmarkCorpus.json` (sources) | `docsUrl`, `repoUrl` | 51 |
| Design reference library | `src/_data/references.json` | `links[].url` | 28 ext |
| Web-standard refs | `src/_data/blocks.json` | `webStandards.*.reference` | 94 |
| Capability-presence rows | `src/_data/benchmarkCapabilityPresence.json` | `rows[].url` | 1,266 |
| Intent docs | `src/_data/intents.json` | URLs in HTML `description` | 70 |

Emit **one deduped index** `{ url, home, sourceId, label }` (a generated `src/_data/*` data file +
the extractor under `scripts/`). Dedup by canonical URL — the same `docsUrl` recurs across corpus,
references.json, and capability-presence rows. Demoable state: a count-by-home render / the generated
index file.

## Explicitly out of scope (keeps this fork-free at size 3)

- **Freeform homes** — `reports/*.md` (~550 links, lossy markdown), `researchTopics.json` (prose, 0
  structured URLs). A markdown-citation parser is a separate, lossy concern — file as a follow-on slice
  if the dogfood proves it's needed.
- **Internal-only refs** — `backlog/*.md` `crossRef` (263, all internal `/backlog`·`/research` paths)
  and `adapters.json`/`protocols.json` (no URLs). Not external references; nothing to monitor.
- **Liveness fetching** (#585's job) and **the retirement-shape convention** (#584's decision). This
  slice only *indexes* — it doesn't fetch or classify.

No buried fork: the index schema and canonical-URL dedup are mechanical; the heterogeneous-home
retirement shape is #584's decision, not this build's.
