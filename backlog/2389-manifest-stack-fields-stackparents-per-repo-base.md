---
kind: story
size: 2
parent: "2387"
status: open
dateOpened: "2026-07-10"
tags: []
---

# Manifest stack fields: stackParents + per-repo base

Extend the WE lane manifest (we:scripts/readiness/lane-manifest.mjs buildManifest/validateManifest/serializeManifest) with stackParents (an asItemId list — the frontier tip item(s) a lane was cut from or merged onto) and a per-repo base SHA; add --stack-parent (repeatable) and --base to we:scripts/lane-manifest-write.mjs. Backward-compatible: both optional, absent means today sibling behavior. Tests: round-trip, defaults, and validation.
