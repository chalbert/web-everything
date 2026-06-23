---
kind: story
size: 8
parent: "1663"
status: open
blockedBy: ["1664", "1667"]
locus: plateau-app
dateOpened: "2026-06-23"
tags: []
---

# Repro-bundle export and replay tool in the dev browser

Build the export+replay TOOL in the plateau-app dev browser: capture the current moment, serialize it to a repro bundle conforming to the #1664 contract, mint a shareable link, and on the other side open that link to replay the action trace and land in the identical declared context. Composes the #1664 shape and the FUI viewer components. Local-first and zero-server per the cost-flat rule. Rides the shared trace/replay capture substrate #1667 — a `blockedBy` prerequisite (shared with #1646 and #1649) this slice consumes, not builds; wire it up once #1667 ships.
