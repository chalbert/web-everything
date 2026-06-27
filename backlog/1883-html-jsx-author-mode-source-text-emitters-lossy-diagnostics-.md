---
kind: story
size: 5
parent: "746"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: frontierui/blocks/renderers/component/htmlSource.ts
tags: []
---

# html/jsx author-mode source-text emitters + lossy/diagnostics for the FUI workbench

Carve-out from #1865 Fork 1 (which ratified shipping the 3 faithfully-emitted author-mode forms first). The author-mode panel names five forms but FUI emits three — declarative, wc-class (generateClassSource), functional (generateFunctionalSource); there is no html or jsx source-text emitter and no lossy/diagnostics computation anywhere under fui:blocks/renderers/. Build the two missing text emitters off the existing case fixtures (fui:blocks/renderers/component/__fixtures__/component-cases.ts), plus the per-form lossy/diagnostics computation so a form that cannot be honoured faithfully arrives lossy:true under the panel's 'flag, don't fake' doctrine. Pure emitters (like the existing two), independent of the v1 wiring (#1618) — adding them later just lights up two more tabs.
