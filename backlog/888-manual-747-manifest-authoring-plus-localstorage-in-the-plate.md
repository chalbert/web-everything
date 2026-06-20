---
kind: story
size: 3
parent: "746"
status: resolved
locus: plateau-app
relatedProject: webdocs
blockedBy: ["886"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: plateau-app/src/design-system-creator/manifest.ts
tags: [webdocs, design-system, theme-creator, plateau, dtcg, localstorage]
---

# Manual #747 manifest authoring plus localStorage in the Plateau creator

Token picker + intent-defaults (density/motion/surface) + trait-defaults (radius/feel) emit a valid #747 manifest, validated against the #871 shape, persisted/restored via localStorage, with an in-Plateau live preview.

## Progress (resolved 2026-06-18) — locus plateau-app

Built the manual authoring layer onto the #886 creator shell:

- **`plateau:manifest.ts`** — the #747 manifest model: `buildManifest(state)` emits `{ extends, themeTokens, intentDefaults?, traitDefaults? }` (the #871 shape), `validateManifest` mirrors WE`s `validateDesignSystem` manifest layer (extends required, themeTokens non-empty, intentDefaults keys ∈ known intents, traitDefaults free-form), and `saveManifest`/`loadManifest` persist/restore via localStorage (best-effort, storage-injectable).
- **`plateau:creator.ts`** — now functional: an editable **token picker** (one input per theme token), **intent-defaults** (density/motion/surface) and **trait-defaults** (radius/feel) selects, all emitting + validating the manifest on every edit, **persisting to localStorage** and **restoring on mount**, with an **in-Plateau live preview** that applies the authored tokens as CSS custom properties to a sample card. The upsell CTA seam (#886) is retained (sync across devices = the account-gated upsell).
- **Tests** — `plateau:manifest.test.ts` (8: build/validate/persist) + `plateau:creator.test.ts` (8: editable tokens, pickers, valid manifest, persist+preview, intent record, restore-on-remount, CTA seam, idempotent). Full plateau suite green (222 tests).

Authoring against a registry now produces a valid #747 manifest locally; hosted sync/share + export are the later paid slices (#749/#754).
