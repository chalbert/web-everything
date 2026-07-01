---
kind: decision
parent: "1971"
status: open
dateOpened: "2026-07-01"
tags: []
---

# Foundational SSR + hydration surface for comment-anchor directive regions

Design the SSR + client-hydration surface for comment-anchor (`CustomComment`) directive regions — the foundational call #2005 is blocked on. No SSR surface exists in FUI today (`fui:plugs/webdirectives/` is parse/lifecycle only — no server renderer, no hydration hook), so this is a true GAP: no design *and* no impl. Extracted from #2005's body by `/slice 2005` (2026-07-01, `we:reports/2026-07-01-backlog-split-analysis.md`); resolving it cuts #2005 into serialize / server-render / hydrate / streaming stories.

## Forks to decide

1. **Server-render architecture** — where/how FUI produces marker + stamped-content HTML off-DOM (no live `document`). Is there a `renderToString`-shaped entry over the directive lifecycle, or does it reuse the client stamp path against a DOM shim?
2. **Marker / anchor convention** — align the comment-anchor markers to DOM Parts `ChildNodePart` (the migration constraint already carried by #1971's nesting slices) so SSR output and client hydration share one marker grammar.
3. **Directive-state serialization** — how per-region directive state (e.g. `for-each` keys/length, `view:if`/`view:switch` branch) serializes *into the comment text* so hydration can resume without re-deriving it.
4. **Client hydration hook** — the recognize-markers / skip-re-stamp path: how a booting directive detects it was server-stamped and adopts the existing nodes instead of re-rendering.
5. **Streaming / lazy hydration** — whether nested regions hydrate eagerly or stream/defer (interacts with #1977 defer-hydration triggers).

## Definition of ready

Each fork above carries stated options + a bold default, grounded against the real `fui:plugs/webdirectives/` surface and the DOM Parts alignment #1971 already commits to. Not prepared yet — run `/prepare 2030`.
