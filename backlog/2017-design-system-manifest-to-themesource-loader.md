---
kind: story
size: 5
parent: "1226"
status: resolved
blockedBy: ["2049"]
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: [parity, webtheme, dtcg, flavor, keystone, integration-seam]
---

# Design-system manifest → ThemeSource loader (the parity integration seam)

## Resolved — the loader is built; the consumption seam it depended on is ratified (#2026) and emitted (#2049)

The blocker (#2026, projection-vocabulary + alias-tier ownership) ruled **(b′)**: the FUI injector co-emits the
semantic-alias tier alongside canonical `--token-*` at every themed scope, and **#2049** implemented that runtime
co-emit (`applyTokenVars` writes both tiers, sourced from the FUI-owned `LEGACY_ALIASES`). With that seam live,
the loader's visible-retheme acceptance is meetable: an injected `ThemeSource`'s `--token-*` values are forwarded
to the semantic names FUI components read (`var(--color-surface)`, `var(--radius-lg)`, `var(--color-border)`).

Built in FUI as `fui:plugs/webtheme/manifestLoader.ts`:
- `loadManifestTheme(manifest, parent?)` — resolves the manifest's DTCG `themeTokens` over the platform default
  (`extendTokens` + `resolveTokens`), bridges the resolved token set into the flat legacy `ResolvedTheme` families,
  and returns an injectable `ThemeSource` parented on the ambient base (unbridged families inherit the default).
  Ready for `setRootTheme(loaded.source)` (page-wide) or a scoped injector set (per-subtree).
- `bridgeDtcgToLegacy(doc)` — the DTCG→legacy bridge, stated as an explicit, inspectable per-row map
  (`DTCG_TO_LEGACY`, the #930-A "declared coverage, not a hidden transform" discipline): the DTCG `color.accent`
  seed maps onto the legacy `primary` role, the `space` scale onto `spacing`, `elevation` onto `shadow`, the
  `type` size ramp onto `font`, and so on. A row whose DTCG source is absent is recorded in `coverage.absent`,
  never silently dropped.
- Unit test `fui:plugs/webtheme/__tests__/unit/manifestLoader.test.ts` covers DTCG alias resolution (a base-derived
  radius token resolves to its literal), templated `calc()` resolution, deep-merge over base, declared-absence
  coverage, and the paint acceptance (`applyTokenVars` lands `--token-*` + the co-emitted alias tier a card reads).

The loader takes a **resolved manifest object** (its `themeTokens` sidecar loaded by the caller via `fs`/`fetch`),
so no component or the loader imports a design-system-specific token file (acceptance 3), and it stays Node/DOM-neutral.
Follow-on: closing the three untokened card props is the separate active item #2050; the badge tone→`--tone-*`
migration (#2026 Fork 2(a)) is its own follow-on.

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
