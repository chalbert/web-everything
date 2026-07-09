---
kind: epic
parent: "1971"
status: resolved
dateOpened: "2026-07-01"
dateResolved: "2026-07-09"
graduatedTo: none
tags: []
---

# SSR & hydration of comment-anchor directive regions

Deferred Phase-2 branch of #1971: server-render comment-anchor regions (markers + stamped content), then client-side hydrate (recognize markers, skip re-stamp), with directive state serialized in comment text; streaming/lazy hydration of nested regions. Seeded from #1971's build list.

**Foundational design #2030 resolved (2026-07-01)** — codified at `we:platform-decisions.md#ssr-external-io-standard-renderers-conform` (external I/O is a language-agnostic WE standard + WE-owned conformance vectors; renderers conform behind the wire-format seam). The chain is now cut into agent-ready child slices:

1. **#2063** — codify the wire-format + hydration handshake in WE + author the conformance vectors *(load-bearing; everything conforms to it)*
2. **#2064** — Node reference renderer (DOM-shim → serialize, behind a swappable `ServerRenderer` seam; the vector oracle) — `blockedBy` #2063
3. **#2065** — directive-state serialization (bounded in-marker + `data-key`) — `blockedBy` #2064
4. **#2066** — client `hydrate(root)` adopt path (shared idempotency set) — `blockedBy` #2065
5. **#2067** — streaming (block-until-`:end`; defer-dimension gated on #1977) — `blockedBy` #2066

Related, outside this epic: **#2068** (reconcile the FUI runtime `:start`/`:end` markers to the standard `open-close` grammar) and the future epic **#2069** (per-language/framework native renderers, validated against the #2063 vectors). Original could-not-split rationale: `we:reports/2026-07-01-backlog-split-analysis.md`.
