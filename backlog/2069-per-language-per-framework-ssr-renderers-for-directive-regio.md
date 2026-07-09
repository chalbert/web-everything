---
kind: epic
parent: "1971"
status: open
dateOpened: "2026-07-01"
relatedReport: reports/2026-07-09-backlog-split-analysis.md
tags: []
---

# Per-language / per-framework SSR renderers for directive regions (native, validated against WE conformance vectors)

Umbrella for native server renderers of comment-anchor directive regions across languages/frameworks (Go, Rust, PHP, Python, .NET, JVM…) so any backend produces hydratable directive-region output with good per-language perf. Every renderer conforms to the language-agnostic WE wire-format standard (#2063) and MUST pass the same WE-owned conformance vectors — that interchangeability behind the single JS client is what makes the wire format the swap seam (per we:platform-decisions.md#ssr-external-io-standard-renderers-conform). The whole foundational SSR chain (#2030 design, #2063 wire format + vectors, #2064 Node reference renderer/oracle, #2065–67 state/hydrate/streaming) is resolved, so the vectors are stable and each language renderer is a fork-free build against a frozen contract (render internals are a conforming black box, not a decision — #2030). Home is FUI impl (WE #6 — WE ships no renderer). **Sliced (2026-07-09):** one foundational WE slice — export the vectors as language-neutral data + a cross-language grading harness — then one sub-epic per language renderer, each a future `/slice` candidate seeded with its resolved design lineage. See we:reports/2026-07-09-backlog-split-analysis.md.
