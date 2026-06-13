---
type: issue
workItem: story
size: 5
parent: "170"
status: open
locus: frontierui
blockedBy: ["447", "448"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
tags: []
---

> **Locus: frontierui (2026-06-13).** This task edits Frontier UI's path-alias config, deletes
> `frontierui/plugs/`, and verifies "FU build + tests green" — it builds and gates in **frontierui**,
> not webeverything. Both blockers (#447, #448) are now resolved, so it's ready — but in the FU repo
> with its own gate. A webeverything `/batch` correctly holds it out of the pool.

# Wire the @we/plugs/* alias in Frontier UI and delete the vendored plugs tree

Once WE is the runtime superset (#447 + #448), point Frontier UI at @we/plugs/* via path alias (the plateau-app precedent) and delete frontierui/plugs/. WE-ahead files (webvalidation×6, webguards×2, declarativeInjector, webinjectors/Injector + index #278, webregistries/CustomElementRegistry) reach FU through the alias automatically — no copy-down (folds in the body's old step (b), which would have been throwaway). Keep FU-only globals.d.ts out of the aliased path. Verify FU build + tests green. Terminal dedup of #170.


## Sizing note (2026-06-13, batch pre-flight) — task -> story-5

Reclassified during a batch. "Point FU at @we/plugs/* and delete frontierui/plugs/" understates the work, because FU does **not** import plugs through one alias today:

- **75 relative `../plugs/` import lines across 52 files** in `frontierui/blocks/` must be rewritten — deleting the tree breaks every one.
- **8 existing per-package aliases** (`@webbehaviors/*` -> `plugs/webbehaviors/*`, etc.) must be repointed to `../webeverything/plugs/...` across **3 config files** (`tsconfig.json`, `vite.config.mts`, `vitest.config.ts`).
- **7 FU-only test files WE lacks** (`CustomAttributeRegistry.defineLazy/inert/visibility` unit tests + 4 e2e specs under `plugs/__tests__/e2e/`) sit *inside* the tree being deleted. WE has only `CustomAttributeRegistry.test.ts`, so this is a **code superset but not a test superset** — a **sub-decision**: relocate them (to `frontierui/__tests__/`, importing via `@we/plugs`) vs. migrate up to webeverything. Coverage must not be silently dropped.
- `globals.d.ts` (FU-only) must move out of the aliased path.
- High blast radius (a tree 52 files depend on) -> acceptance "FU build + tests green" needs a full build + vitest (+ e2e) cycle.

No design fork on its *home* (clearly frontierui, plateau-app precedent at `tsconfig.json:16` + `vite.config.mts:119`) — only mis-sized + one test-relocation sub-decision. Work whole via `/next 449` in a focused FU session.
