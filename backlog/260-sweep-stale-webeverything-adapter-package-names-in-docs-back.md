---
type: issue
workItem: task
status: resolved
blockedBy: ["239"]
dateOpened: "2026-06-10"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: none
tags: [adapters, packaging, docs, frontier-ui]
---

# Sweep stale @webeverything/* adapter package names in docs/backlog to @frontierui/*

The #239 re-scope renamed the five adapter/compiler packages @webeverything/* → @frontierui/* in code, but markdown references to the old names linger in several backlog items (#088, #081, #125, #126, #233, #240, #244) and we:reports/2026-06-06-adapter-real-project-integration.md (install steps, package tables). Sweep those to the @frontierui/* names so docs match the published reality. Pure doc hygiene — no code; skip historical-audit lines that are accurate as as-built snapshots, fix forward-looking install/usage instructions and open-item references.

## Progress

- **Status**: resolved.
- **Fixed** (forward-looking / open-item references): `#088`, `#240`, `#081`, and
  `we:reports/2026-06-06-adapter-real-project-integration.md` (install steps, framework wiring table,
  `jsxImportSource` examples) — all five package names swept to `@frontierui/*`.
- **Skipped by rule** (resolved items — accurate as-built / pre-fix audit snapshots, not misleading
  forward guidance): `#125` (extraction as-built), `#231`, `#233`, `#244`, `#126`, and `#239` (whose
  narrative intentionally cites the old `@webeverything/*` names to explain the mis-scope it fixed).
  The re-scope itself is documented in `#239`, so the lineage is traceable from those records.
- **Verified**: no `@webeverything/{component-compiler,jsx-runtime,vite,esbuild,rollup-plugin}` refs
  remain in the four fixed files; `check:standards` green.
