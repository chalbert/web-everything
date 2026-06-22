---
kind: story
size: 2
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# Relocate mock-server FUI → Plateau

Per #1565 (we:docs/agent/platform-decisions.md#devtools-placement): fui:tools/mock-server/ is a dev utility run against your own build — an operator-facing surface, so it relocates to plateau-app. Mechanical move; confirm no FUI build/test depends on it as a serve-time impl (if it does, that part stays FUI per impl-is-not-a-standard).

## Progress (resolved 2026-06-22, batch-2026-06-22-1556-1557-1559)

Mechanical relocation, FUI → plateau-app. **Confirmed the conditional first:** the mock-server dir is
fully self-contained (every import is relative / `node:` / `vitest` — zero FUI-external deps) and **nothing
in FUI imports it** (the only `mock-server` mention in FUI was a doc comment in `fui:tools/explorer/cli.ts`,
not an import; no npm-script references it either). So the whole utility moves with no "stays-FUI" residual.

- **Moved** `fui:tools/mock-server/` → `plateau:src/mock-server/` (cli/console/contract/server + the README +
  the sample contract fixture + `__tests__`). Homed under `src/` so plateau's `src/**/*.test.ts` vitest glob
  discovers the suite (plateau has no `tools/` dir); it's CLI/dev tooling, unimported by the app so not
  bundled.
- **Deleted** the FUI copy; updated the now-stale doc comment in `fui:tools/explorer/cli.ts` (it referenced
  the old mock-server CLI path) to point at the new plateau home.

**Verified:** plateau `npm test` **315 pass** (+36 mock-server), no tsc errors on the moved dir; FUI
`check:standards` green (0 errors — nothing depended on the removed dir). One operator-facing dev utility,
now in its #1565-correct home.
