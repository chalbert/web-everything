---
kind: story
size: 8
parent: "2069"
status: open
dateOpened: "2026-07-09"
tags: []
---

# Native Python SSR renderer for directive regions

Native Python server renderer for comment-anchor directive regions (FUI impl, WE #6 — WE ships no renderer). From scratch in Python: parse the authoring template source, expand all 7 directive types (for-each keyed+empty, if, switch/case, resource:loader, defer), and emit the byte-exact WE wire format (normative space-padding + bounded in-marker state tokens), behind the swappable ServerRenderer seam (frontierui:plugs/webdirectives/ssr/). Conforms to the wire format (#2063) and passes the WE-owned conformance vectors byte-for-byte via the cross-language harness (#2354's language-neutral JSON export). Render internals are a conforming black box (#2030) — a pure build.

**Analysed by `/slice` (see we:reports/2026-07-09-backlog-split-analysis.md) and found atomic** — one coherent port graded by a single byte-exact suite (no layer-slice leaves a passing-vector state; a per-directive split is a fat-head/thin-tail chain), so it is a single `story·8`, not a further-sliceable epic. The one portability weight: Python has no DOM-shim serializer to reuse (the Node reference's happy-dom shortcut is JS-only), so it hand-rolls a byte-exact parser + serializer to match the goldens.
