---
kind: story
size: 3
parent: "1971"
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Reconcile FUI runtime directive markers to the standard open-close grammar (runtime emits :start/:end)

Pre-existing conformance gap surfaced by #2030 (independent of SSR). The published WE standard's boundary grammar is open-close — control:if / /control:if (we:project-webdirectives.njk:474) — but the FUI runtime emitted a different convention, name:start / name:end with a directive-specific namespace (fui:ForEachBehavior.ts:147, fui:ViewIfDirective.ts:85, fui:ViewSwitchDirective.ts:77), which the inspector also accepts (fui:directiveInspector.ts:27-34). Per WE #6 the runtime spelling cannot override the published spec, so the runtime and inspector must emit/prefer the standard grammar. Not blocked by the SSR chain — proceeded in parallel.

**Resolved (#2068).** Migration decided **emit-standard / accept-both**: the runtime now emits the published open-close grammar, and the inspector keeps accepting the legacy `:start`/`:end` convention during the transition (no reader breakage). Landed in FUI:

- fui:ForEachBehavior.ts emits `<!-- control:for-each items="…" [key="…"] -->` … `<!-- /control:for-each -->` (was `for-each:start (…)` / `for-each:end`).
- fui:ViewIfDirective.ts emits `<!-- control:if condition="…" -->` … `<!-- /control:if -->` (was `view-if:start`/`view-if:end`).
- fui:ViewSwitchDirective.ts emits `<!-- control:switch value="…" -->` … `<!-- /control:switch -->` (was `view-switch:start`/`view-switch:end`).

The output now matches the SSR wire format (#2030) byte-grammar, so runtime-stamped and server-emitted regions carry identical boundary markers. fui:directiveInspector.ts `classify` already recognized both conventions (`open-close` + `start-end`); it was left as accept-both so mixed/legacy trees still surface. Scoped to the three directives named in the standard's control table; `view-defer`/`view-async` (no published comment-marker grammar in the table) were deliberately left out of scope. Regression-covered by the updated fui:ForEachBehavior.test.ts emit assertion plus the unchanged inspector/lifecycle accept-both tests (62 directive tests green).
