---
kind: epic
parent: "2069"
status: open
dateOpened: "2026-07-09"
tags: []
---

# Native .NET SSR renderer for directive regions

Native .NET server renderer for comment-anchor directive regions (FUI impl, WE #6 — WE ships no renderer). From scratch in .NET: parse the authoring template source, expand all 7 directive types (for-each keyed+empty, if, switch/case, resource:loader, defer), and emit the byte-exact WE wire format with normative space-padding + bounded in-marker state tokens, behind the swappable ServerRenderer seam (frontierui:plugs/webdirectives/ssr/). Conforms to the language-agnostic wire format (#2063) and passes the WE-owned conformance vectors byte-for-byte via the cross-language harness (#2354, now resolved). Render internals are a conforming black box (#2030), not a ratifiable fork — a pure build.

**Partial split (`/slice 2360`, 2026-07-09):** the full build decomposition can't be carved yet — the .NET renderer contract isn't scoped and there's no .NET impl surface in-repo to ground slices against (see we:reports/2026-07-09-backlog-split-analysis.md). So the epic's **first slice is the contract-scoping pass** (the child story); its artifact then exposes the per-directive-family build slices, which get scaffolded under this epic once it lands. The same shape applies to the four sibling sub-epics still filed as epics (#2355–2358); #2359 (Python) was separately found **atomic** in this same pass (a build-as-one `story·8`, no scoping child) — see its `/slice` note. Whether #2355–2358 (and #2360 itself) should likewise collapse to atomic is the open re-analysis flagged in we:reports/2026-07-09-backlog-split-analysis.md.
