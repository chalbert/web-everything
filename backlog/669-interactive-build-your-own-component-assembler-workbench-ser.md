---
type: issue
workItem: story
size: 13
parent: "646"
status: open
blockedBy: []
locus: plateau-app
relatedProject: webdocs
dateOpened: "2026-06-15"
tags: [devtools, composition, assembler, workbench, served-surface, plateau-app, deferred-build, needs-slice]
---

# Interactive build-your-own-component assembler workbench (served tool)

The deferred build #646/#609 explicitly name: the recipe is the standard, the tool is downstream. An interactive build-your-own-component workbench — pick intent/block primitives, wire them, preview the composition, eject the registry-item recipe (#652 Fork 2: a standalone devtools surface reading the shared workbench* vocabulary + the #667 preset registry, read-only). Per the #091 managed-offering split its served home is plateau-app (standard + preset registry stay in WE via #667; primitives in Frontier UI). Greenfield and cross-locus, so it re-estimates well over a task: this story is a tracking placeholder, to be re-sliced in plateau-app context once #667 lands and a registry standard exists to build against.

## Re-slice trigger reached (2026-06-15)

The precondition the card named has landed: **#667 is resolved** — the preset registry standard now exists
(`src/_data/assemblerPresets.json` + `src/presets.njk` + `validatePreset`, the read-only vocabulary this
workbench builds against), and its stale `blockedBy: ["667"]` edge is cleared. Confirmed during a batch
pre-flight: this remains a **greenfield, cross-locus umbrella** — pick primitives → wire → preview → eject
the registry-item recipe is well over a single batchable story. Reclassified `size: 13` (out of the batch
pool) and tagged `needs-slice`. **Next action: `/slice 669`** in plateau-app context into independently
deliverable slices (candidate first slice: a read-only workbench surface that lists/previews presets from
the #667 registry; later slices add the wire/compose authoring and the registry-item eject). Not built in
this batch — the card's own framing makes it a slice trigger, not a buildable seam.
