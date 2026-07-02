---
kind: story
size: 2
parent: "1257"
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: "#1257 platform-standards watch (front-B error-region lens; baseline swept, no proposal yet)"
tags: []
---

# Watch — declarative error-region standards direction (error-boundary migration target)

Standing watch for any declarative error-region / error-boundary primitive emerging in a standards venue (WHATWG/W3C/OpenUI) — the missing native migration target recorded by #1978's ruling. Error-boundary is the one directive-catalog plug with no native substrate or proposal to migrate toward; #1978 admitted it as a scoped plug (#95 — the plug IS the proposed direction) with this watch as the criterion-4 rider. Trigger: any such proposal appears → file the deprecation/migration path for the directive (#2136) toward it.

## Baseline sweep — 2026-07-02 (watch established, no proposal yet)

This size-2 story **establishes** the watch and records its baseline reading; the standing cadence is owned by the parent platform-standards program ([#1257](1257-*.md), front B) — this item does not itself run perpetually. It is scoped to the error-region lens of the front-B sweep and folds into #1257's review log going forward.

- **Venues swept:** WHATWG/HTML (issues + spec directive table), W3C, OpenUI. **Result: no declarative error-region / error-boundary primitive or standards-track proposal exists** as of 2026-07-02. React's error boundaries (and the Solid/Vue/Svelte 5/Angular `@error` analogs) remain framework-only, with no native counterpart in any venue — confirming #1978's finding that error-boundary is the one directive-catalog plug with **no native substrate to migrate toward**.
- **Confidence sibling framing:** the four other catalog siblings have native anchors (async→DOM Parts, virtualized→content-visibility, snippet→Template Instantiation, content-security→Sanitizer). Error-boundary alone has none — so the [#1963 criterion-4](../docs/agent/block-standard.md#composition-rubric) "designed to migrate when the native standard ships" clause has **no live target**; the plug ([#95](../docs/agent/platform-decisions.md)) is the sole proposed direction until this watch fires.
- **Trigger (unchanged):** any declarative error-region proposal surfacing in a standards venue → file the deprecation/migration path for the directive ([#2136](2136-build-the-error-boundary-directive-comment-boundary-live-reg.md)) toward it, and repoint the plug per native-first ([#031](docs/agent/platform-decisions.md#native-first-baseline)). Not fired yet.
