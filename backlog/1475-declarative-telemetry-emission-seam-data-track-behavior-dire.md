---
kind: story
size: 5
status: open
blockedBy: []
dateOpened: "2026-06-21"
tags: []
---

# Declarative telemetry emission seam — data-track behavior/directive over CustomTracker sink

Build the ratified (#1415) author-facing declarative emission seam for webanalytics: a data-track-style behavior/directive that binds an element's interaction (click/submit/view/focus/custom) to resolve(CustomTrackerRegistry).track(), document-level binding, no rendered surface. Reuses the already-built CustomTracker sink (#1012), contract, and Analytics Event Vocabulary protocol. Degrades to NoopTracker when no sink configured. Web Directives vs Web Behaviors home decided during build (both non-rendering annotation layers).
