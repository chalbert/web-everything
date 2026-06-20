---
kind: story
size: 5
status: open
dateOpened: "2026-06-20"
tags: [reproduction, gap-sweep, shadcn]
relatedProject: webintents
relatedReport: reports/2026-06-20-1243-shadcn-first-gap-delta.md
---

# surface intent: neutral surface roles (border, muted, muted-foreground)

Reproduction-conformance gap #5 from shadcn (#1243). shadcn leans on neutral surface roles --border / --input / --muted / --muted-foreground / --secondary; webtheme exposes only bg/fg/accent and delegates the rest to intents (#403), but no intent currently supplies neutral border/muted surface roles, so input borders and muted text have no token home. Add neutral surface roles to the surface intent. Surfaced by reproduction #1243, feeds gap-sweep #315.
