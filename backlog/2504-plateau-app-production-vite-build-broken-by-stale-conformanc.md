---
bornAs: xhdax28
kind: task
status: resolved
dateOpened: "2026-07-14"
dateResolved: "2026-07-21"
tags: [plateau-app, build, bug]
---

# plateau-app: production vite build broken by stale conformance-engine reference after the #2341 package move

The plateau-app production build (`vite build`) fails before bundling: `plateau:conformance.html` (a registered Rollup build input in `plateau:vite.config.mts`, wired as the `conformance` entry alongside the product `index` entry) still loads a module that no longer exists at that path. Found 2026-07-14 during the /constitution page work.

**Exact breakage.** `plateau:conformance.html` line 34 is:

```html
<script type="module" src="/src/conformance-engine/conformanceEmbed.ts"></script>
```

That reference resolves to `plateau:src/conformance-engine/conformanceEmbed.ts`, which is **missing** — the entire `plateau:src/conformance-engine/` directory is gone. It was **moved, not deleted**: commit `1b78f55` (`resolve #2341`, 2026-07-09) extracted the shared conformance-engine into the new `packages/core` workspace, relocating the module to `plateau:packages/core/src/conformance-engine/conformanceEmbed.ts` (a pure git rename, 0 content change). The HTML entry point was never re-pointed at the new location.

**Observed failure** (`npx vite build`):

```
[vite:build-html] Failed to resolve /src/conformance-engine/conformanceEmbed.ts from conformance.html
✗ Build failed in 27ms
```

`0 modules transformed` — the build dies at the HTML-input resolve step, before any bundling.

**Why it landed unnoticed / why CI stays green.** The `test` (vitest) and render-conformance gates do **not** process `plateau:conformance.html` as a Rollup entry, so they never resolve that script tag — the moved module's imports still resolve fine everywhere the tests exercise it. Only `vite build` walks the HTML entry inputs, so the failure is exclusive to the production build. The gates passed and the #2341 move landed green.

**Impact.** No production `vite build` succeeds → plateau-app has no working production build and cannot ship until this is fixed.

**Fix direction** (impl lives in plateau-app; this card is the tracker): re-point the `plateau:conformance.html` line-34 script `src` at the module's real location — either the moved path `plateau:packages/core/src/conformance-engine/conformanceEmbed.ts` or the `@webeverything`/`@plateau/core` alias the config exposes for that package — or, if the standalone conformance iframe surface is no longer needed as a build input, drop the `conformance` input from `plateau:vite.config.mts` and remove the dead HTML. Restoring a resolvable reference is the true fix; the specifics were verified against the working tree on 2026-07-14.

## Resolved — already fixed in code, verified green (2026-07-21)
The re-point already landed (the "restore a resolvable reference" fix direction). `plateau:conformance.html`
line 34 now loads the module from `plateau:packages/core/src/conformance-engine/conformanceEmbed.ts` (the moved
path, which exists on disk) instead of the dead `plateau:src/conformance-engine/conformanceEmbed.ts`. The
correction rode in plateau-app commit `5d6cff2` (#2507 "Backlog-view v1"); the dead path was last present in
`d82efd7` (#1801).

**Verified green:** `npx vite build` in plateau-app now succeeds — **599 modules transformed**, emits
`plateau:dist/conformance.html` (1.65 kB) + a `conformance-*.js` chunk (46.46 kB), `✓ built in 911ms`. The
`[vite:build-html] Failed to resolve … Build failed in 27ms` failure no longer reproduces. No change needed;
closing on verification.
