---
kind: epic
size: 8
parent: "1971"
status: open
blockedBy: ["2064"]
dateOpened: "2026-07-01"
tags: []
---

# Per-language / per-framework SSR renderers for directive regions (native, validated against WE conformance vectors)

Future epic surfaced by #2030's cross-language delivery goal: deliver native server renderers for most languages/frameworks (Go, Rust, PHP, Python, .NET, JVM…) so any backend produces hydratable directive-region output, with good perf via per-language impl. Each renderer conforms to the language-agnostic WE wire-format standard (#2063) and MUST pass the same WE-owned conformance vectors — that is what makes them interchangeable behind the single JS client (the wire format is the swap seam, per we:platform-decisions.md#ssr-external-io-standard-renderers-conform). Blocked on the Node reference renderer (#2064) as the vector oracle. Slice per-language once vectors are stable.
