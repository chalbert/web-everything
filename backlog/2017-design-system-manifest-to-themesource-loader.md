---
kind: story
size: 5
parent: "1226"
status: open
blockedBy: ["2049"]
dateOpened: "2026-07-01"
tags: [parity, webtheme, dtcg, flavor, keystone, integration-seam]
---

# Design-system manifest → ThemeSource loader (the parity integration seam)

## Blocked — the visible-retheme acceptance depends on an undecided consumption seam (#2026, 2026-07-01 batch pre-flight)

Claimed under a serial batch; a mid-work pre-flight found the Digest's core premise is **false as stated**.
The Digest says *"the FUI components actually read the legacy family-based model
(`fui:plugs/webtheme/resolveTheme.ts:25`)"* — but a grep for `resolveTheme` / `getRootTheme` / `ThemeSource`
across `blocks/`, `demos/`, `workbench/`, `plugs/` finds **zero consumers** outside `fui:plugs/webtheme/`
itself. No FUI component reads the theme runtime at all. The `we-card` / `we-badge` blocks read a
hand-authored **site vocabulary** (`var(--color-border)`, `var(--color-surface-card)`, `var(--radius-md)`,
`var(--shadow-sm)` — see `fui:blocks/card/Card.ts:91-100`), which is **neither** the legacy family emit
(`--token-color-*` from `fui:plugs/webtheme/emitCss.ts`) **nor** the DTCG compile names.

**Consequence:** the loader + DTCG→legacy bridge + unit test (Acceptance 2 & 3) are mechanical and buildable,
but Acceptance **1** — *"injecting it visibly re-themes a live `we-card` + `we-badge`"* — is **unmeetable** as a
standalone: an injected `ThemeSource` paints `--token-*` props no component consumes. Making a card visibly
re-theme requires first **deciding the projection-vocabulary contract** (does `ThemeSource` project onto the
components' current `--color-*`/`--radius-*` names, or do the block CSS migrate onto `var(--token-*)`?) and the
block-CSS migration path. A **lossy DTCG→`--wb-*` precedent** exists for the workbench stage **only** (#930-A,
`fui:workbench/manifestBridge.ts`) — that decided the *demo* seam, not the real component seam. This is
undecided platform design, so it is filed as **#2026** and this story is `blockedBy` it. Do **not** unilaterally
pick a vocabulary to force batchability. Once #2026 rules, this story builds the loader + wires it to whatever
projection #2026 chose.

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
