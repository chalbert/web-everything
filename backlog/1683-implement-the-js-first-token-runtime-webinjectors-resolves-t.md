---
kind: epic
workItem: epic
status: open
locus: frontierui
dateOpened: "2026-06-23"
dateStarted: "2026-06-27"
relatedProject: webinjectors
tags: [design-tokens, theme, webinjectors, webtheme]
---

# Implement the JS-first token runtime: webinjectors resolves the theme, one-way synced to CSS custom properties

> **Sliced under batch-2026-06-26-1793-1697.** Pre-flight found this is **greenfield FUI runtime** work, not WE: per the zero-impl rule (#1282) the token runtime lives in `fui:plugs/webinjectors`/`webcontexts`, and FUI has **no** theme/token-resolution substrate yet (no `webtheme` dir). The body already flagged it splittable ("injector provision · CSS-sync · migration"); converted to an epic over three slices so each is independently deliverable and verifiable (the off-DOM acceptance — pre-attach read, OffscreenCanvas worker, console — needs a focused FUI session a serial batch can't browser-verify inline):
> - **#1811** (frontierui, 5) — injector resolves the theme, readable synchronously off-DOM (pre-attach / worker / console). The head; no blocker.
> - **#1812** (frontierui, 3, `blockedBy` #1811) — one-way emit of a `--token-*` CSS custom property per resolved token (scope consistency + no-drift; carries the single-source-emit residual #1682 deferred).
> - **#1813** (webeverything, 3, `blockedBy` #1811 #1812) — migrate `we:src/css/style.css` `:root` vars onto the emitted set.

Build the runtime #1682 ratified. The injector (`we:plugs/webinjectors/` + webcontexts) becomes the source of truth for the resolved theme — every CSS-relevant token family readable synchronously by any JS, off-DOM, no cascade, no loop. From that one source, emit a CSS custom property per token (one-way JS→CSS, single-source so they can't drift), preserving cascade / light-DOM scope / dark-mode for paint. Migrate the hand-authored `we:src/css/style.css` `:root` vars onto it. Acceptance: constructor pre-attach read, OffscreenCanvas worker, `console %c`, and scoped JS/CSS consistency all work (the off-DOM cases that motivated #1682). May split (injector provision · CSS-sync · migration) once scoped.

## Acceptance criteria (the off-DOM consumers that motivated #1682)

- **Pre-attach compute** — a custom element reads its resolved theme in its **constructor**, before it is in the DOM, with no `getComputedStyle` and no FOUC.
- **Worker / OffscreenCanvas** — code with no DOM at all paints with a theme colour read from the injector (or a posted snapshot of it).
- **Console** — `console.log("%c…", "color: …")` uses a theme colour with no element to query.
- **Scope consistency** — a scoped subtree (`scoped-token-override`) resolves the **same** value whether read from JS (injector child scope) or painted by CSS (`--token-*` redeclaration), because both come from one source row.
- **No drift** — CSS custom properties are emitted from the injector, never hand-authored in parallel; removing/renaming a token updates both projections from the one source.

## Notes

Per #1682 (ratified 2026-06-23 — the JS-first-vs-CSS-first ruling, codified at `we:docs/agent/platform-decisions.md#tokens-js-first`). Carries the **single-source emit** residual #1682 deferred here: how the injector's resolved set generates `--token-*` at build (static set) and at registration (dynamic/app-added set). Sequencing candidates if split: (1) injector theme provision (unblocks worker/console/canvas), (2) one-way CSS sync, (3) migrate `we:src/css/style.css` `:root` vars onto the emitted set.
