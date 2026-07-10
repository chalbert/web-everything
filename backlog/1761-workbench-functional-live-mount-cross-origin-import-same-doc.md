---
kind: story
size: 5
parent: "912"
status: resolved
blockedBy: ["1760", "1030"]
dateOpened: "2026-06-24"
dateStarted: "2026-07-09"
dateResolved: "2026-07-10"
graduatedTo: none
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot, functional-adapter]
---

# Workbench functional live-mount — cross-origin import + same-document mount of the functional form into the stage (analog of #1030, render-target ruled by #1594)

The consumer half of the #1746-GO chain: reuse the cross-origin-import + same-document mount harness #1030 builds in fui:workbench/mount.ts to import the #1760 functional-live module and mount() it into the STAGE — the single canonical introspection slot ruled by #1594 (codified #single-introspection-slot) — with window.onerror/unhandledrejection + ErrorBoundary runtime-error surfacing, reusing the inspector/event/anatomy panels. Known wrinkle to resolve at build: unlike the wrapper live form (#1518) which mounts the REAL custom element and forwards attrs+events, the functional render is the React/jsx lowering itself — NOT a custom element — so panel introspection of a non-CE tree may be degraded; surface it at build and file a follow-up only if it needs a call.

## 2026-07-09 — DONE

Reused the #1030 harness unchanged for its actual mount/update/unmount contract — the only real gap was that
fui:workbench/loader.ts's `ServedShape` assumed a `<tag>` custom element (register locally + query by tag
name), which the #1759/#1760 functional-live module has none of (it is the bare JSX lowering itself, not a
custom element):

- **fui:workbench/loader.ts** — `ServedShape.tag` is now optional. `loadBlockShape`'s `served` arm degrades
  `create()` (the A/B-compare-cell fallback) to the same "no live stage" placeholder pattern source-only
  blocks already use, when no tag is declared.
- **fui:workbench/live-test/liveMount.ts** — doc-only: clarified `resolveSubject`'s existing `tag='*'`
  fallback (already defensively coded, never previously exercised) is exactly what a tag-less functional
  render needs — the mounted host's first rendered element stands in as the subject; a bare-Text-node render
  resolves to `null`, the flagged, honest introspection degradation.
- **fui:workbench/mount.ts** — no logic change; `liveModule`/`renderLiveStage`/`teardownLive` already operate
  purely through the abstract `mount/update/unmount` contract, so they cover a tag-less functional block for
  free. Doc comments updated to name the functional case alongside the wrapper case.
- **fui:workbench/registry.ts** — new `maasFunctionalServedUrl()` helper (builds a fui:/_maas/fn/<caseId>.js
  serve URL, the #1619 separate id-space) + a `component-functional-live` `WorkbenchBlock` (no `tag`, no
  `cem`, no `traits` — the honest shape for a bare JSX render); `withServedOrigin()` now rebuilds via
  whichever id-space (functional vs wrapper) the block's current `servedUrl` targets, so repointing at a
  throwaway verification origin (the `?maas=` pattern #1030 established) works for both forms.

**Panel introspection degradation (the wrinkle flagged in scope):** confirmed and accepted, not filed as a
follow-up. A tag-less functional block naturally omits the CEM-driven Polyglot wrapper-generation panel and
the attribute-based Traits/Anatomy panels (no `cem`/`traits` declared — nothing to introspect for a render
that is not a custom element); the Runtime-errors panel and subject resolution are generic and still work.
No richer functional-specific introspection surface is needed yet — a real call only if usage of this block
surfaces one.

**Verified:** fui:workbench/__tests__/mountLiveFunctional.test.ts (new, 4 tests) drives the real
`mountWorkbench` shell over a tag-less served block with a mocked loader (mirrors
fui:workbench/__tests__/mountLive.test.ts's posture for the wrapper case) — subject resolution via the `*`
fallback, prop-routed `update`, `unmount` teardown, and the Polyglot/Traits panel omission.
fui:workbench/__tests__/loader.test.ts pins the tag-less shape contract. Separately, a throwaway (never
committed) Playwright script proved the underlying mechanism in a REAL browser: a bare Node HTTP server
wrapping `createFunctionalServeHandler` with an injected fixture case (mirroring
fui:tools/maas/__tests__/functionalLiveProducer.test.mjs's own fixture) on one throwaway port, a plain host
page on a second throwaway port, a cross-origin dynamic import of the served functional-live module resolving
to `mount(el,{name:'Ada'})` → `'Hello Ada'` rendered → `update({name:'Grace'})` → `'Hello Grace'` →
`unmount()` → host cleared. No production config (fui:vite.maas.config.mts) touched; the user's real dev
servers untouched throughout.

**Production wiring note (mirrors #1030's own `backgroundTasksLive` precedent):** `component-functional-live`
points at the real functional-serve route (#1760, already shipped), which 404s per-case until the WE
we:src/_data/authorModeSource.json artifact it reads exists — a separately-tracked data-transport concern
(#1760's own note), not a #1761 blocker. The block goes live automatically the moment that artifact ships,
with no further workbench-side change.

FUI `check:standards`: 0 errors (13 pre-existing warnings, unrelated to this change). `npm test -- run`:
388 files / 4278 tests green (0 failures).
