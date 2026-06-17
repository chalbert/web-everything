---
type: issue
workItem: story
size: 3
parent: "872"
status: open
blockedBy: ["873"]
dateOpened: "2026-06-17"
tags: []
---

# Factor #694 block-family contract halves into @webeverything/contracts (FUI-coordinated)

The six #694-migrated block families (audit, lifecycle, master-detail, selection, stepper, tree-select) carry mixed contract types (e.g. SelectionModel/SelectionOptions/SelectionChange) plus runtime, but their canonical copies are locus:frontierui and WE keeps byte-identical copies under the #170 drift guard. #873 could not factor them WE-only without breaking byte-identity, so it factored only the WE-owned planes (guard, validity-merge, validator-resolution). This factors each family's pure-contract half into a @webeverything/contracts entry, done in lockstep across WE+FUI (or folded into the #875 FUI migration) so byte-identity is preserved. Provides the family contract entries #874 packages and #875 imports.
