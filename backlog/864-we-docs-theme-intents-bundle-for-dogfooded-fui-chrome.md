---
kind: story
size: 5
parent: "777"
status: resolved
blockedBy: ["871"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "design-systems/we-docs.designsystem.json (+ we-docs.tokens.json + designSystems.json we-docs entry — the WE-docs brand bundle in the #871 registry)"
tags: []
---

# WE-docs theme + intents bundle for dogfooded FUI chrome

Adopt a FUI theme + intents bundle (#747, resolved) so the FUI components mounted into WE-docs chrome carry WE-docs branding. Gate cleared: #765 (relax) and #747 both resolved. First migration slice of the dogfood rework.

## Prior re-block cleared (2026-06-17) — #871 shipped the registry

An earlier batch pre-flight re-blocked this on the missing bundle infrastructure (#747 ruled the shape but the `we:designSystems.json` registry + `/design-systems/` catalog + `validateDesignSystem` were unbuilt). That prerequisite **#871 is now resolved** (`we:src/_data/designSystems.json` + the catalog + validator exist), so this item is authorable and was worked in this batch. The secondary note still holds — the *application* of this brand to live mounted chrome rides #865 (the chrome migration) — but authoring the bundle is independent of it and is the actual scope of this card.

## Progress

Done — authored the WE-docs brand bundle into the #871 registry, the first **real-consumer** design-system (vs the material-like / acme-brand demo bundles):

- `we:design-systems/we-docs.tokens.json` — DTCG token file carrying the site's *real* brand (not invented): `color.accent` = `#4f46e5` (Indigo-600, the site's `--color-primary`), `accent-hover` `#4338ca`, `text` `#1e293b` (Slate-800), `text-muted` `#475569` — all the WCAG-AA contrast-tuned values from `we:src/css/style.css` (#793).
- `we:design-systems/we-docs.designsystem.json` — manifest: `extends: @webtheme/default`, `themeTokens: we:./we-docs.tokens.json`, `intentDefaults: { density: comfortable, motion: natural }` (real values from the `density`/`motion` intent dimensions), `traitDefaults: { radius: md }`.
- `we:src/_data/designSystems.json` — registry entry `we-docs` (name "Web Everything Docs", `ownedByProject: webdocs`, `status: concept`).

Verified: all JSON valid; `check:standards` (runs `validateDesignSystem`) 0 errors — themeTokens resolves, `extends` resolves to the platform sentinel, every `intentDefaults` key resolves in we:intents.json, `ownedByProject` resolves in we:projects.json; 11ty `--dryrun` clean; live `/design-systems/` catalog renders the "Web Everything Docs" / WE-docs entry. When #865 mounts FUI chrome into WE-docs, selecting this bundle is what makes that chrome carry WE-docs branding.
