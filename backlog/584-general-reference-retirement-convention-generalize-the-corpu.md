---
type: decision
workItem: story
parent: "583"
size: 5
status: open
blockedBy: ["583"]
dateOpened: "2026-06-14"
relatedProject: webdocs
tags: [monitoring, references, retirement, convention, freshness]
---

# General reference-retirement convention (generalize the corpus 'retired' shape across all reference homes)

Generalize #546's corpus-source retirement convention (retired/retiredDate/retiredReason, keep-not-delete) beyond benchmarkCorpus.json to every place the project cites an external reference — report citations, /research/ topic sources, crossRef URLs, adapter/protocol spec links. The fork: one uniform retirement shape vs per-home shapes, since reference homes are heterogeneous (a JSON source row vs a markdown citation vs a frontmatter crossRef). Also: where the convention lives (a shared schema fragment vs per-file), and how it interacts with #192's supersedes/supersededBy chain when a reference is superseded rather than simply dead. Decision, not build, because of the heterogeneous-homes fork.
