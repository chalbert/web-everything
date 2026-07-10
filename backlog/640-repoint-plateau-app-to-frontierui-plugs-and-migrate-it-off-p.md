---
kind: story
size: 5
status: open
blockedBy: ["2382"]
dateOpened: "2026-06-14"
dateStarted: "2026-07-09"
tags: []
---

# Repoint plateau-app to @frontierui/plugs and migrate it off plugged bootstrap to unplugged

plateau-app currently aliases @we/plugs (vite.config.mts:119) and imports the plugged @we/plugs/bootstrap (plateau:src/main.ts:9) — a real app on the demo-only plugged path, violating the [Constellation placement](docs/agent/platform-decisions.md#constellation-placement) invariant (origin #606) that real apps use the unplugged surface. Repoint the alias to @frontierui/plugs and migrate plateau-app to unplugged consumption (register/upgrade, no global patching). Blocked on the canonicalization (#170).

## Discovery (2026-06-22, batch-0622) — split into done repoint + blocked migration

Claimed in batch-0622; on inspection the two halves have diverged:

- **Repoint half — already DONE** (by #1046): plateau-app has **zero** `@we/plugs` refs left; `plateau:vite.config.mts` + `plateau:vitest.config.ts` alias `@frontierui/plugs` and the HTML/SSR paths reference `@frontierui/plugs/bootstrap`. The body's `@we/plugs` citations are stale.
- **Unplugged-migration half — BLOCKED on #1545.** Dropping the plugged `bootstrap` for the unplugged surface (`register`/`upgrade`, no global patching) requires plateau-app's **root-document** custom elements (`<route-view>`, the `route:*` attrs, reactive text, etc.) to upgrade without the global `window.customElements` swap. That swap is `applyPatches` step 3 in `fui:plugs/webregistries/index.ts` — still **disabled** (line ~95). #1544 (this batch) implemented the root-scope *determination path* the swap needs but explicitly did **not** re-enable it; the re-enable is **#1545** (`webregistries re-enable root customElements swap`, OPEN). Until #1545 lands, a root-document app cannot consume unplugged.

**State fix:** added `blockedBy: 1545` (the real prerequisite; #170 is resolved). The story stays open and re-surfaces once #1545 resolves. No code change landed (the repoint was already complete; the migration is the blocked residual).

## Progress (2026-07-09) — original blockers cleared, but now BLOCKED on the monorepo split (#2346)

**Status:** OPEN, blockedBy **#2346**. The two *original* blockers (#170, #1545) are resolved, so the
unplugged migration itself is now feasible — but it **cannot land yet** because plateau-app's `main`
does not boot after the in-flight package extraction. Re-surfaces once #2346's wiring is complete.

**Why it's blocked (discovered at land time):** the extraction epic **#2346** (siblings #2340/#2341/
#2344/#2345, all landed 2026-07-09) moved big chunks of the app into workspace packages and rewrote
plateau:src/main.ts to import from them — but the wiring is incomplete: Vite cannot resolve those
workspace specifiers (no `resolve.alias`, no workspace symlink, no package `exports`, and Vite does not
read the tsconfig paths). A fresh dev server **500s at boot** and the app renders nothing. Filed as its
own blocker under #2346. A migration to unplugged can't be verified on a non-booting app, so #640 waits.
(The production **build** is *also* red — #2341 left plateau:conformance.html pointing at a deleted
embed — filed separately.)

**Prototype (done, but against the PRE-#2344 structure — kept as a reference for when #2346 unblocks):**
The migration was implemented and browser-verified on the older layout (before marketing moved into the
saas package). That work does not apply cleanly to current `main` and was **not** landed; the plateau-app
edits were reverted, leaving that repo clean at origin/main. What the prototype established still holds:
- **Grounding:** plateau's plug surface is entirely **behaviors + the injector context chain**
  (`route-view`/`route:link`/`nav:list`/droplist/`on:*`, plus `customContexts:routeGuard`/`routeLoader`/
  `handlers` on the document injector). **Zero** `{{ }}` interpolation, **zero** `<template type=…>`
  directives, so `attributes.upgrade(subtree)` fully covers activation (the app already upgrades its 3
  dynamic-insert subtrees). `InjectorRoot.getProviderOf` is static class-state (works unplugged once
  `attach(document)` runs); `route-view`'s initial nav is native `customElements.define`-timed —
  identical plugged vs unplugged. FUI already ships frontierui:plugs/bootstrapUnplugged.ts (the drop-in
  unplugged entry: register-set + `upgrade`, no realm patches, no window globals).
- **Verified (on the old layout):** `window.attributes`/`injectors`/`WebEverything`/`stores` all
  `undefined` (unplugged proven); landing + `route:link` SPA nav + `/pricing` deep-link clean; authed
  shell + `/apps` loader (10 items — injector context chain works unplugged) + app-detail routing all OK.

**Re-application plan once #2346 unblocks:** the root-app half (plateau:src/main.ts + a new
plateau:src/runtime.ts `bootstrapUnplugged()` singleton + drop the `we-bootstrap` HTML injection in
plateau:vite.config.mts) rebases with only line offsets. The 5 marketing mounts now live in the
`@plateau/saas` package and still read `(window as any).attributes`; a package can't import the app's
runtime, so inject the upgrade capability into the package (a small `setBehaviorUpgrader()` seam the app
calls once at bootstrap, or thread an `upgrade` param through the `mount*()` fns) rather than a global.

## Progress (2026-07-09) — re-pointed: #2346 resolved, boot fixed (#2381), now waits on the build-red #2382

The umbrella blocker **#2346 resolved** (monorepo split delivered) and the boot-after-extraction blocker
**#2381 resolved** — so a fresh plateau-app dev server boots again and the unplugged migration is
verifiable. The one remaining open piece of the same extraction fallout is **#2382** (the conformance
build entry still points at an embed file #2341 deleted → red production build). #640's own reasons for
waiting listed *both* the boot 500 (now fixed) and the red build; the build half is #2382. Re-pointed
`blockedBy: [2346]` → `[2382]` — the genuine remaining open dependency. Clears once #2382 lands; if the
red build turns out not to gate the dev-verified unplugged migration, drop the edge and start #640.
