---
type: issue
workItem: story
size: 3
parent: "125"
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: none
tags: [jsx, adapters, packaging, dedupe, frontier-ui]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Re-sync `@frontierui/jsx-runtime`'s JSXRenderer to canonical + guard against drift

**Foundation slice of the JSXRenderer dedupe** (split out 2026-06-10) — this item now owns the
decision-free, immediately-batchable half: re-sync the package copy
(`fui:frontierui/packages/jsx-runtime/src/JSXRenderer.ts`) to the WE canonical and add a drift guard so they
can't diverge again. The decision-gated remainder — repointing FUI's blocks off the older divergent
copy #2 — is **#265** (`blockedBy` this item **+ #264**, the bare-specifier-resolution decision).

#125 created `@frontierui/jsx-runtime` (`fui:frontierui/packages/jsx-runtime/src/JSXRenderer.ts`) by
copying the **canonical** factory from `we:webeverything/blocks/renderers/jsx/JSXRenderer.ts`. There are
now **three** copies of the DOM factory:

1. `we:webeverything/blocks/renderers/jsx/JSXRenderer.ts` — the canonical source (fullest: function
   components / directive duck-typing, customized-built-in `is`, namespaced `on:`/`bind:` attrs,
   `<template>.content` routing).
2. `we:frontierui/blocks/renderers/jsx/JSXRenderer.ts` — an **older, divergent** copy (lacks the above).
3. `fui:frontierui/packages/jsx-runtime/src/JSXRenderer.ts` — the new package copy (= #1, plus one
   `as unknown as` cast for the package's `strict` build).

Drift risk: a mirror-dialect fix now has to land in up to three places. Once the package is the
published home, the in-repo consumers should **import from `@frontierui/jsx-runtime`** rather than
keep local copies:

- Point `frontierui/blocks/renderers/jsx` (and its `vite.config.mts` `jsxInject` / `tsconfig`) at the
  package, deleting copy #2.
- Decide whether `webeverything`'s own blocks consume the package or stay the canonical source that
  the package is generated/copied from (the constellation puts the *standard* in webeverything, the
  *impl/package* in frontierui — so webeverything may remain the source of truth that the package
  mirrors, with a check that they match rather than a hard import).

**#239 resolved — unblocked, but bigger than story·3 (re-checked 2026-06-10, batch claim-time pre-flight).**
#239 built out the package source (`packages/jsx-runtime/src` now has `we:index.ts` / `fui:jsx-runtime.ts` /
`fui:jsx-dev-runtime.ts` / `fui:auto-define.ts` / `we:JSXRenderer.ts` — the half-built `dist` concern is gone) and
re-scoped names to `@frontierui/*`. But #239's own close-out note flags jsx-runtime as *still duplicated,
untouched, tracked by #240/#170* — so this is genuinely the next step. Pulled into a batch and **released
without building** because two wrinkles push it past a quick dedupe slice into a focused single-item:

1. **The package copy is stale vs the WE canonical, not a clean mirror.** `fui:frontierui/packages/jsx-runtime/src/JSXRenderer.ts`
   (293 lines) is missing two features WE's canonical `we:webeverything/blocks/renderers/jsx/JSXRenderer.ts`
   (311 lines) has: the **Auto-Define `#241`** `static tagName` → `document.createElement` registry path,
   and the **`#245`** inline string-event-handler-attribute branch. So the dedupe must **re-sync the package
   from canonical first** (port both, preserving the package's one `as unknown as` strict-build cast) — and
   only then can a "they match" check be meaningful. Plain "point consumers at the package" would ship a
   renderer regressed below canonical.
2. **The browser resolution topology for the bare specifier is unsettled.** FUI serves jsx via a vite
   path-inject — `vite.config.mts` `jsxInject: import jsx from '/blocks/renderers/jsx'`, with `we:index.ts`
   re-exporting the local copy #2. #239's note says the importmap currently resolves the package *name*
   back to **WE's own source**, not the built `dist`. So "FUI blocks consume `@frontierui/jsx-runtime`"
   requires a real decision — built `dist` vs a vite src-alias vs importmap entry — before deleting copy #2
   and repointing `jsxInject`/`tsconfig`. That plus a **frontierui build+test gate** (separate repo) is the
   focused scope.

**This slice (#240) — the decision-free foundation:** (a) re-sync package `we:JSXRenderer.ts` from WE
canonical (port #241 Auto-Define `static tagName` path + #245 inline string-event-handler branch, keep
the one `as unknown as` strict-build cast); (d) add a WE↔package match-check test so the two can't drift
again. **Done = the package renderer is feature-equal to canonical and the match-check guards it; FUI
`we:JSXRenderer.test.ts` green.** No consumer repointing, so no resolution decision is needed here — that's
why it batches now.

**Deferred to #265 (the decision-gated remainder), `blockedBy` this + #264:** (b) settle the
bare-specifier resolution mechanism (#264 decision — built `dist` vs vite src-alias vs importmap); (c)
repoint `frontierui/blocks/renderers/jsx` at the package + delete copy #2, update `vite.config.mts`
`jsxInject`/`jsxFactory` + `tsconfig`; (e) verify both repos' suites (FUI build, WE blocks suite +
`check:standards`).

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow (WE); changes also in `../frontierui` working tree
- **Done:**
  - (a) Re-synced `fui:frontierui/packages/jsx-runtime/src/JSXRenderer.ts` from WE canonical: ported the
    #241 Auto-Define `static tagName` → `document.createElement(tagName)` registry path in
    `#createElement`, and the #245 inline string-event-handler-attribute branch in `#applyProps`.
    Preserved the package's one `as unknown as Record<string, unknown>` strict-build cast. The two
    files are now byte-identical modulo that single cast.
  - (d) Added drift guard `fui:frontierui/packages/jsx-runtime/__tests__/canonical-sync.test.ts` — reads
    both files, normalizes the sanctioned strict-cast, asserts equality; `it.skipIf` when the sibling
    `../webeverything` checkout is absent (same convention as FUI `we:check-standards.mjs`).
- **Verification:** FUI `we:JSXRenderer.test.ts` green (26 tests); new sync test green; package `tsc`
  strict build OK; WE `check:standards` 0 errors.
- **Notes:** No consumer repointing — that decision-gated remainder stays in **#265** (`blockedBy`
  this + the #264 bare-specifier-resolution decision). dist artifacts are gitignored in FUI.
