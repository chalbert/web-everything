---
kind: task
parent: "646"
status: resolved
blockedBy: ["688"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: plateau-app/src/component-assembler/ejector.ts
tags: []
---

# Eject the registry-item recipe from the assembler composition

Slice C of the #646 composition assembler (sibling of #669 slice A, #688 slice B). Serializes the live composition from the authoring canvas (#688) into the shadcn registry-item shape that validatePreset enforces ({name, type, composesBlocks/Intents, files:[{path,content}]}, matching we:src/_data/assemblerPresets.json exactly), with copy/download via the output-panel pattern already in intent-configurator. Demoable: compose primitives → click eject → get a valid registry-item payload that round-trips into the we:assemblerPresets.json shape. Blocked on #688 (needs a composition to eject).

## Progress

- **2026-06-15 — built + verified (the #688 canvas unblocked it).** New
  `plateau:plateau-app/src/component-assembler/ejector.ts`: a pure `buildRegistryItem(composition)` that serializes
  the canvas's live selection (blocks + intents + set dimensions + composed markup) into the shadcn
  registry-item shape `validatePreset` (#667) enforces — `name` (a file-safe slug from the primitives),
  `type` (`registry:block`), `title`, `description`, `status: draft`, `ownedByProject: webdocs`,
  `composesBlocks`/`composesIntents`, `intentStrategies` (each intent's set dims flattened to one string),
  and a non-empty `files[]` with the composed markup. `registryItemJson` pretty-prints it.
- **Wired into the canvas (#688):** an Eject panel renders the recipe JSON live as you compose, with
  **Copy JSON** + **Download .json** (the intent-configurator output-panel pattern). The DOM-free
  `buildRegistryItem` keeps the logic testable.
- **Verified:** `plateau:ejector.test.ts` (5 tests) — the reveal-nav round-trip, the required-field shape
  validatePreset enforces, the dimension→intentStrategies flatten, the empty-composition placeholder, and
  JSON round-trip. Live on :4000: composing nav-list + disclosure + anchor(escape) + hover-intent ejects a
  valid registry-item (`composesBlocks`, `intentStrategies.anchor === 'escape'`, copy + download present),
  zero page errors. plateau-app `npm test` 166/166 green.
