---
kind: epic
parent: "2069"
status: open
blockedBy: ["2354"]
dateOpened: "2026-07-09"
tags: []
---

# Native Go SSR renderer for directive regions

Native Go server renderer for comment-anchor directive regions (FUI impl, WE #6 — WE ships no renderer). From scratch in Go: parse the authoring template source, expand all 7 directive types (for-each keyed+empty, if, switch/case, resource:loader, defer), and emit the byte-exact WE wire format with normative space-padding + bounded in-marker state tokens, behind the swappable ServerRenderer seam (frontierui:plugs/webdirectives/ssr/). Conforms to the language-agnostic wire format (#2063) and passes the WE-owned conformance vectors byte-for-byte via the cross-language harness (blocked on the foundational export slice). Render internals are a conforming black box (#2030), not a ratifiable fork — a pure build.

**Sliced (2026-07-27):** mirrors the JVM (#2355) / .NET (#2360) shape — one foundational slice (greenfield Go build subtree + parse/dispatch scaffold + shared helpers + the Go-side conformance harness runner + the two branch-select directives if/switch to prove the pipeline), then two per-directive slices fanning out behind it (for-each keyed+empty+count/key-hash state tokens; resource:loader + defer). Each slice passes its own vector subset byte-for-byte (fixture-driven demo). DAG: foundation → {for-each, resource:loader+defer}.
