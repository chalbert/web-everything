---
kind: epic
parent: "2069"
status: open
dateOpened: "2026-07-09"
tags: []
---

# Native .NET SSR renderer for directive regions

Native .NET server renderer for comment-anchor directive regions (FUI impl, WE #6 — WE ships no renderer). From scratch in .NET: parse the authoring template source, expand all 7 directive types (for-each keyed+empty, if, switch/case, resource:loader, defer), and emit the byte-exact WE wire format with normative space-padding + bounded in-marker state tokens, behind the swappable ServerRenderer seam (frontierui:plugs/webdirectives/ssr/). Conforms to the language-agnostic wire format (#2063) and passes the WE-owned conformance vectors byte-for-byte via the cross-language harness (#2354, now resolved). Render internals are a conforming black box (#2030), not a ratifiable fork — a pure build.

**Sliced (2026-07-09, `/slice 2360` then #2374's scoping pass):** the contract-scoping child (#2374, resolved) pinned the .NET project layout, parser strategy, `ServerRenderer` seam shape, and harness invocation — its artifact is the build-slice breakdown below (see we:reports/2026-07-09-backlog-split-analysis.md, `/slice 2360` reconciliation section, appended 2026-07-09). Reconciled against the JVM (#2355) re-analysis: the Node oracle's directives are independent plugs on a dispatch map, not a rigid `parse → expand-all-7 → emit` chain, so .NET fans out the same way JVM did — one foundational slice + two independent per-directive slices, not a single atomic build.

**Build slices (children of this epic):** foundation + if/switch (story·5, unblocked) → {for-each (story·3, `blockedBy` foundation), resource:loader+defer (task·2, `blockedBy` foundation)}. Each passes its own vector subset byte-for-byte (fixture-driven demo), mirroring #2368–2370 (JVM). DAG: foundation → {for-each, resource:loader+defer}.

The same re-analysis is still owed for the three remaining sub-epics filed as unscoped epics (#2356–2358, Go/PHP/Rust) — flagged, not done here (out of #2374's .NET-only scope). #2359 (Python) was separately found **atomic** (a build-as-one `story·8`, no scoping child) — see its own `/slice` note.
