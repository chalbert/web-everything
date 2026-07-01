---
kind: story
size: 5
parent: "1226"
status: open
dateOpened: "2026-07-01"
tags: [parity, webtheme, dtcg, flavor, keystone, integration-seam]
---

# Design-system manifest → ThemeSource loader (the parity integration seam)

## Digest

**Keystone for the reproduction-conformance program (#1226).** The parity claim — *"the difference between any two
top design systems is theme tokens + intents and nothing else"* (#1225) — cannot be exercised end-to-end today
because the seam is broken. The DTCG token runtime (`fui:webtheme/tokens.ts`, `fui:webtheme/compile.ts`) is the
published contract, but the **FUI components actually read the legacy family-based model**
(`fui:plugs/webtheme/resolveTheme.ts:25` — `rootTheme = new ThemeSource(defaultTheme)`). There is **no loader**
that reads a `{ extends, themeTokens, intentDefaults, traitDefaults }` design-system manifest (the #747 shape,
e.g. `we:design-systems/material-like.designsystem.json`), resolves its DTCG override over the platform default,
and produces a `ThemeSource` for injection. Without this, every "flavor" is either a hardcoded ~5-token workbench
preset (`fui:workbench/designSystems.ts:47-90`) or an inert manifest stub — none can genuinely drive components.

Build that loader. It is the prerequisite for B1–B4 (#2022–#2025): only once a manifest can flow into components
can a shadcn/Material/Fluent/Carbon flavor be authored and measured.

## Scope

- Write a loader that takes a design-system manifest (`{ extends: "@webtheme/default", themeTokens, intentDefaults?,
  traitDefaults? }`) and: resolves `themeTokens` (DTCG override) over the base via `fui:webtheme/tokens.ts` →
  `extendTokens()`; bridges the resolved DTCG token set into the legacy family model consumed by
  `fui:plugs/webtheme/ThemeSource.ts`; returns a `ThemeSource` instance.
- Wire it into `fui:plugs/webtheme/resolveTheme.ts` so `setRootTheme()` (or a scoped inject) can be fed a
  manifest-loaded theme instead of the hardcoded `defaultTheme`.
- Load a manifest from `we:design-systems/*.designsystem.json` + its `*.tokens.json` sidecar.

## Acceptance

- Loading `we:design-systems/material-like.designsystem.json` and injecting it visibly re-themes a live FUI
  `we-card` + `we-badge` (accent, radius, spacing) — proven in the workbench or a Playwright shot, JS-on.
- The DTCG→legacy bridge is covered by a unit test (`fui:` test): alias resolution + deep-merge over base.
- No component code imports a design-system-specific token file; everything flows through the manifest loader.

## Notes / boundary

- Impl lives in FUI (WE holds zero impl). WE contributes only the manifest data under `we:design-systems/`.
- The declarative markup-scoping layer (`<div data-theme="…">`, slice 2 of #1682, deferred as #1910) is **out of
  scope** here — this item does the imperative loader that unblocks parity authoring; scoping can follow.
