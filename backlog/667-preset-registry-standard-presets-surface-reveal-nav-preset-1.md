---
kind: story
size: 3
parent: "646"
status: resolved
relatedProject: webdocs
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "src/_data/assemblerPresets.json + src/presets.njk (preset registry standard, /presets/ surface, reveal-nav preset #1, validatePreset)"
tags: [devtools, composition, assembler, preset-registry, registry-item, reveal-nav, presets-surface]
---

# Preset registry standard + /presets/ surface + reveal-nav preset #1

Foundational slice of the #646 composition assembler — the part that needs no tool, since the ejectable recipe IS the standard (#652 Fork 1). Author a WE-owned preset registry (we:src/_data/assemblerPresets.json) in the decided shadcn registry-item shape ({name, type, composesBlocks/Intents, files:[{path,content}]}), with reveal-nav as preset #1: its files[].content is the plain-markup payload already running live in the dogfood header (we:base.njk:32-69 + we:style.css:241-276), composing nav-list + disclosure + anchor strategy=escape + hover-intent.

Add a /presets/ auto-render surface copying the /protocols/ pattern (we:src/presets.njk + nav + validator). Demoable: /presets/ renders the recipe and it round-trips into the live header. Unblocks every additional preset as batch-time volume.
