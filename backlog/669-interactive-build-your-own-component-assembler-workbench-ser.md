---
type: issue
workItem: story
size: 3
parent: "646"
status: resolved
blockedBy: []
locus: plateau-app
relatedProject: webdocs
relatedReport: reports/2026-06-15-backlog-split-analysis.md
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: plateau-app src/component-assembler/ (read-only assembler surface, /component-assembler route)
tags: [devtools, composition, assembler, workbench, served-surface, plateau-app]
---

# Read-only interactive assembler surface (plateau-app) — slice A of #646

**Slice A of the #646 composition assembler** (sliced 2026-06-15, run `/slice 669` in
[reports/2026-06-15-backlog-split-analysis.md](../reports/2026-06-15-backlog-split-analysis.md)). The
foundational increment of the served interactive workbench (#652 Fork 2 → plateau-app per #091): a
read-only surface that lists the presets from the #667 registry and **previews each composition live** —
the shell that later slices grow authoring and eject onto.

Clone the proven plateau-app served-tool shell pattern (mirror
`src/intent-configurator/configurator.ts`): a new `src/component-assembler/assembler.ts` + `.css`, a
`mountComponentAssembler(mount)` registered in `src/main.ts`, and a nav link + `route` template in
`index.html`. Read the WE registry cross-locus the same way intent-configurator already does
(`intent-configurator/configurator.ts:18` imports `../../../webeverything/src/_data/intents.json`) — here
import `assemblerPresets.json`. For each preset, list its `composesBlocks/Intents` and render each
`files[].content` **live** alongside the recipe source.

**Demoable:** navigate to the assembler route in plateau-app → see the reveal-nav preset → its composed
markup renders live (the same widget running in the WE dogfood header).

Forks already settled — emit format + home by #652 (ratified), the preset registry by #667 (resolved,
`assemblerPresets.json` + `validatePreset`). The canvas authoring UX is POC-mode latitude, carved into the
sibling slices below, not a buried decision here.

## Progress

Resolved 2026-06-15. plateau-app served surface (commit → plateau-app); read-only, data-driven from the WE registry.

- **`src/component-assembler/assembler.ts` + `.css`** (new) — `mountComponentAssembler(root)` mirrors the Intent Configurator served-tool shell. Reads the WE registry cross-locus the same way (`import presetData from '../../../webeverything/src/_data/assemblerPresets.json'`, identical `src/<tool>/` depth to `intent-configurator/configurator.ts`). For each preset it renders: title/name/type/status, description, `composesBlocks`/`composesIntents` chips (intent chips fold in `intentStrategies`, e.g. `anchor: escape`), a **live preview** of the composition, and a `<details>` per `files[]` with the recipe source. The live preview mounts each composition's markup + CSS into its **own shadow root** (`asm-preview`) so it renders exactly as authored without leaking into / inheriting from the Plateau chrome. The script file is shown as source but not executed — slice A is read-only and the CSS baseline already reveals the disclosure UX; the JS enhancement is the later slices' concern.
- **`src/main.ts`** — import + `mountComponentAssembler`, a `tryMountComponentAssembler()` robust-timing mount (same pattern as the other tools), wired into `route-change`, the breadcrumb label map, and the initial deep-link mount block.
- **`index.html`** — `Component Assembler` nav link (Tools section) + `/component-assembler` route template with `#component-assembler-mount`.

Forks were pre-settled (emit format + home #652, preset registry #667); the canvas authoring UX is carved to siblings #688/#689 below — no decision surfaced here.

Verification (in `../plateau-app`): `npm test` (vitest) = 154 passed / 18 files; `tsc --noEmit` introduces **no** new errors in `component-assembler/` (the pre-existing `@frontierui/*`-module + `main.ts:135` errors are untouched baseline). Live probe against the running dev server (:4000) via Playwright: nav item present, 1 preset card rendered ("Reveal navigation menu"), the live-preview shadow root contains `nav.site-nav` with 3 disclosure heads, all 3 recipe files (`reveal-nav.html/css/js`) listed, **zero console errors** — the same widget running in the WE dogfood header.

## Sibling slices (under #646)

- **[#688](688-assembler-authoring-canvas-pick-wire-primitives-into-a-live-.md) — authoring canvas:
  pick + wire primitives → live composition** (story·3, `blockedBy: 669`): a primitive palette read from
  `blocks.json` + `intents.json`, assembling selections into composed markup with live preview.
- **[#689](689-eject-the-registry-item-recipe-from-the-assembler-compositio.md) — eject the
  `registry-item` recipe** (task, `blockedBy: 688`): serialize the live composition → the shadcn
  `registry-item` shape `validatePreset` enforces, with copy/download.
