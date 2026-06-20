---
kind: story
size: 3
status: open
dateOpened: "2026-06-20"
tags: [reproduction, gap-sweep, shadcn]
relatedProject: webintents
relatedReport: reports/2026-06-20-1243-shadcn-first-gap-delta.md
---

# webtheme/intent: focus-ring role (ring color + offset)

Reproduction-conformance gap #4 from shadcn (#1243). shadcn focus-visible uses a --ring color + --ring-offset; webtheme has no focus-ring token role (its semantic tier is the intents, #403), so the focus affordance has no token home. Add a focus-ring role (ring color + offset) on the interaction/focus intent layer so a themed focus outline is expressible. Surfaced by reproduction #1243, feeds gap-sweep #315.
