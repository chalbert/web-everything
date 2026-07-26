---
kind: story
size: 3
status: open
scope: ["we:scripts"]
dateOpened: "2026-07-26"
tags: [guard, hook, constellation, footgun]
---

# guard-backward-edge PreToolUse hook mis-scopes plateau-app FUI-importing src files as WE source

The `we:scripts/guard-backward-edge.mjs` PreToolUse hook denies any WE `src/` file that statically
imports `@frontierui`, enforcing the WE-holds-zero-impl boundary. But its `isWeSource` gate keys on any
path containing a `/src/` segment (`WE_SRC_RE`), regardless of which repo the file lives in. So it wrongly
DENIES a WE-rooted delivery/conveyor agent editing `plateau-app:src/` source that legitimately imports
`@frontierui` — plateau-app is allowed to dogfood Frontier UI (it is the product layer), and that import
is a normal forward edge there, not the backward edge the guard exists to block.

## Problem

`isWeSource(file)` returns true for `(?:^|\/)src\/…\.(ts|tsx|…)`. In a WE-rooted session the agent's edit
targets carry an absolute path into another repo's checkout (e.g. a `plateau-app` clone), so a
`plateau-app:src/**` file trips the same `/src/` match and the hook denies the write — even though the
FUI import is legitimate there. The guard only makes sense against WE's own `src/`.

Confirmed hits: the #2604 and #2660 builds both had WE-rooted agents editing `plateau-app:src/` that
imports `@frontierui`, and both had to script around the guard to land their work.

## Fix

Scope the guard by **repo identity**, not the shared `/src/` path segment — the hook must only fire when
the target is WE's OWN `src/`, and pass through `plateau-app:src/` / `frontierui:src/` (their FUI imports
are forward edges, allowed). Keep the existing `demos/` exclusion and the static-vs-runtime-edge logic
unchanged; only the repo gate is wrong. Cover the new gate with a `plateau-app:src/` case in
`we:scripts/__tests__/guard-backward-edge.test.mjs`.

locus: we
