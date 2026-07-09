---
kind: epic
parent: "2069"
status: open
blockedBy: ["xkyyza1"]
dateOpened: "2026-07-09"
tags: []
---

# Native PHP SSR renderer for directive regions

Native PHP server renderer for comment-anchor directive regions (FUI impl, WE #6 — WE ships no renderer). From scratch in PHP: parse the authoring template source, expand all 7 directive types (for-each keyed+empty, if, switch/case, resource:loader, defer), and emit the byte-exact WE wire format with normative space-padding + bounded in-marker state tokens, behind the swappable ServerRenderer seam (frontierui:plugs/webdirectives/ssr/). Conforms to the language-agnostic wire format (#2063) and passes the WE-owned conformance vectors byte-for-byte via the cross-language harness (blocked on the foundational export slice). Render internals are a conforming black box (#2030), not a ratifiable fork — a pure build. A future /slice candidate once its PHP renderer contract is scoped.
