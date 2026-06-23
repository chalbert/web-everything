---
kind: story
size: 5
status: open
blockedBy: ["1702"]
dateOpened: "2026-06-23"
tags: []
---

# Unified project-config discovery view (derived, non-authoritative aggregator)

Build the optional discovery view ratified by #1662: a plateau-app-locus aggregator/resolver that READS the per-dimension resolved configs and shows the whole project config at one glance (project identity / one-stop discovery). Strictly non-authoritative — never written to, never a second source of truth; the per-dimension keys/files remain the SoT. Dev-oriented (strippable from production). A Technical-Configurator-adjacent surface. Depends on the loader from #1702.
