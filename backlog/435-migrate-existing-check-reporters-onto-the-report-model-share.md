---
type: idea
workItem: story
size: 3
parent: "350"
status: open
blockedBy: ["431", "432"]
dateOpened: "2026-06-12"
tags: []
---

# Migrate existing check:* reporters onto the report model + shared renderers

Point the existing reporters — check:standards, check:app-conformance, check:readiness, the burndown, the capability-manifest — at the report model as producers and replace their bespoke output with the shared renderers, incrementally (one reporter at a time). The burndown/readiness logic stays; only its output shape migrates. Phase 5 of #350; needs the model (#431) and the v1 renderers (#432).
