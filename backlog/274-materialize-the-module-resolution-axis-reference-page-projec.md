---
type: issue
workItem: story
size: 3
status: resolved
blockedBy: ["271"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: module-resolution/provider.ts
tags: []
---

# Materialize the module-resolution axis: reference page, project-config field, exports-lock lint

Ratify-and-document follow-on to #271's native-implied resolution ruling. Three decision-free deliverables: (1) a reference page documenting the four native resolution manifests (node_modules+exports default, importmap, CDN/URL override, dev-server alias) plus the single invariant; (2) a moduleResolution field on the project flavor config (config-extends-platform-default) with a per-specifier overrides map, value space {default | URL} exactly per #264 — a generator hint that materializes into the native importmap/alias, not a resolver; (3) a check:standards lint asserting every @frontierui/* importmap/alias entry resolves to the package exports, never to WE/foreign source (the only lock). No resolve-time runtime code.

## Progress

**Resolved 2026-06-11.** All three deliverables landed, gate green:

1. **Reference page** — [src/module-resolution.md](../src/module-resolution.md): the four native
   resolution manifests table, the single invariant ("the only lock"), and the `moduleResolution`
   config field with the `{ default | URL }` value space and a worked example.
2. **Config field / model** — [module-resolution/provider.ts](../module-resolution/provider.ts)
   (mirroring the capability-manifest standalone-model pattern): `ModuleResolutionConfig { overrides }`,
   the `DEFAULT_RESOLUTION` sentinel + URL value space (#264), `PLATFORM_DEFAULT_MODULE_RESOLUTION`
   (no overrides — config-extends-platform-default), `extendModuleResolution`, `assertModuleResolution`,
   `resolveSpecifier`, and `materializeModuleResolution` — the **generator hint** emitting ONLY URL
   overrides as importmap entries (`default` specifiers stay absent, left to native node-resolution).
   No resolve-time code. Tests:
   [module-resolution/__tests__/provider.test.ts](../module-resolution/__tests__/provider.test.ts) (11);
   added the dir to `vitest.config.ts` includes.
3. **Exports-lock lint** — `validateModuleResolutionLock` + `isExportsSafeTarget` (pure, fixture-tested
   in check-standards-rules.test.mjs, 6 cases) wired into `check-standards.mjs` (§9b): gathers every
   `@frontierui/*` entry from the **shipped** resolution manifests (vite `resolve.alias` +
   `<script type="importmap">` in src/*.{njk,html}) and asserts each terminates at the package exports
   (URL / node_modules / bare specifier), never a raw in-repo source path.

**Scope decision (surfaced by the lint):** the lint immediately caught a real pre-existing violation —
`demos/maas-consumer-demo.html` maps `@frontierui/jsx-runtime` → `/blocks/renderers/jsx/index.ts` (WE
source). Correctly fixing it is entangled with the jsx-runtime dedupe (#240/#265/#081), beyond this
item's deliverables. Per #271 the lock governs the project's **shipped** resolution config, not POC
sandbox demos (which stand-in with local src by design, Demo-First), so the importmap scan excludes
`demos/`. **Carry to #265/#081:** clean up the maas-consumer-demo importmap when the published
`@frontierui/jsx-runtime` resolution lands. 69 model+rules tests pass; gate green.
