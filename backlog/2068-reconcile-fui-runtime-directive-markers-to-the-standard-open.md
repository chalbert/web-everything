---
kind: story
size: 3
parent: "1971"
status: active
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: []
---

# Reconcile FUI runtime directive markers to the standard open-close grammar (runtime emits :start/:end)

Pre-existing conformance gap surfaced by #2030 (independent of SSR). The published WE standard's boundary grammar is open-close — control:if / /control:if (we:project-webdirectives.njk:474) — but the FUI runtime emits a different convention, name:start / name:end with a directive-specific namespace (fui:ForEachBehavior.ts:147, fui:ViewIfDirective.ts:85, fui:ViewSwitchDirective.ts:77), which the inspector also accepts (fui:directiveInspector.ts:27-34). Per WE #6 the runtime spelling cannot override the published spec, so the runtime and inspector must emit/prefer the standard grammar. Decide the emit-vs-accept migration (accept both during transition, emit standard) and land it so runtime output matches what SSR (#2063) emits. Not blocked by the SSR chain — can proceed in parallel.
