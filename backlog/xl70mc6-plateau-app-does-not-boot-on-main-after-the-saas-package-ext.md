---
kind: task
status: resolved
dateOpened: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
tags: []
---

# plateau app does not boot on main after the saas package extraction

After #2344 (extract-packages-saas, landed 2026-07-09) rewrote plateau:src/main.ts imports to the workspace specifiers (the marketing / control-plane / profiles / web-docs mounts now come from the saas package, and core from the core package), Vite cannot resolve them: there is no resolve.alias for them, no node_modules workspace symlink, no package exports map, and Vite does not read the tsconfig paths. So a fresh dev server 500s at boot (Pre-transform error: Failed to resolve import from plateau:src/main.ts) and the app renders nothing. Part of the open monorepo-split epic #2346 (siblings #2340/#2341/#2342/#2343/#2345); its wiring was left incomplete. Fix: add the vite resolve aliases (or a tsconfig-paths plugin / real workspace install with exports) so the workspace specifiers resolve to each package's src, then confirm the app boots. Blocks #640 (unplugged migration needs a booting app to verify). Found while working #640.

**Resolved (2026-07-09):** added the `@plateau/saas` + `@plateau/core` → `packages/*/src` Vite
`resolve.alias` entries in plateau:vite.config.mts (mirroring the tsconfig paths, same shape as the
`@frontierui/*` aliases). Verified on a fresh dev server: plateau:src/main.ts transforms 200 (was
500) and the app boots + renders (landing + `/pricing`, zero console errors). Fix rides plateau-app
**PR #18** (`lane/fix-2346-plateau-boot`). The production **build** is still red separately (see the
sibling plateau:conformance.html item) and #640 stays blocked on the rest of #2346.
