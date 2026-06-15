---
type: idea
workItem: story
size: 3
parent: "623"
status: open
blockedBy: ["626"]
dateOpened: "2026-06-15"
tags: []
---

# Mint the story-canvas block — render a webcase in isolation

Ratified by #626 Fork 2: docs examples ARE webcases, so the docs story renderer is a story-canvas block that renders a single webcase (WebCase = {id,title,description,code}) in component isolation. Interaction-tests fold in as webcases carrying an interaction script. Any docs-only presentation metadata (ordering, prose) is added as optional webcase fields — not a second artifact. One fixture serves both the conformance loop and the docs surface; the #426 ingestion adapters already normalize incumbent stories into webcases, so this consumes that target rather than forking it.
