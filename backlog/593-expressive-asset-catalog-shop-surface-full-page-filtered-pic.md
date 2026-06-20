---
kind: story
size: 3
parent: "586"
status: resolved
blockedBy: ["587", "588"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "demo:expressive-asset-shop + src/_data/expressiveAssets.json (asset catalog registry)"
tags: []
---

# Expressive-asset catalog + shop surface (full-page filtered picker, Web Docs)

The Fork 4 authoring consumer + asset catalog (merged): a dev/designer browses & shops the icon+emoji+sticker catalog inside Web Docs (#398) via a full-page filtered-collection instance of the general picker surface (#588). Also defines the asset catalog — which icon sets / emoji sets / sticker packs exist (today the icon intent has name:string with no catalog). Serves icon+emoji+sticker uniformly. Same see/shop paradigm as #236/#283. blockedBy the intent (#587) + picker surface (#588); relates to epic #398.

## Progress

Both blockers resolved (#587 expressive-symbol intent, #588 picker-surface). Two artifacts:

- **Asset catalog** — created [we:src/_data/expressiveAssets.json](/src/_data/expressiveAssets.json): the open registry of asset *sets* (`icon-set` / `emoji-set` / `sticker-pack`) an author shops — Material Symbols / Lucide / Heroicons (icons), Unicode emoji, a reference sticker pack. Closes the gap that the `icon` intent carried a bare `name: string` with no catalog to resolve against. **Open config registry** (Config-Extends-Platform-Default): WE ships the reference vocabulary, a project extends it — no set mandated. Each set declares its own variant axes mapping onto the icon / expressive-symbol intent dimensions.
- **Shop context** — registered demo `expressive-asset-shop` in [we:src/_data/demos.json](/src/_data/demos.json): the full-page filtered-collection instance of the picker surface that browses the catalog (the authoring-time sibling of the inline `:`-emoji picker — one general surface, two contexts). Surfaces on [/demos/](/demos/).
- The rendered full-page Web-Docs shop surface + runnable page are #398 / Frontier-UI impl concerns; #593 lands the catalog data + the context spec (both `draft`).
