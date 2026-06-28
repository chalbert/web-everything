---
kind: story
size: 3
status: resolved
parent: "1836"
locus: frontierui
blockedBy: ["1926"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: "fui:demos/workbench.ts"
tags: [plugs, unplugged, workbench, dev-experience]
---

# Build the reload-scoped plug toggle in the block workbench (?plug=on|off)

Implements the ratified (c) mechanism from #1845: add a 'plug' key to the workbench's serialized URL state, branch the boot path in 'fui:demos/workbench.ts' on it (plugged 'fui:plugs/bootstrap.ts' vs unplugged 'fui:plugs/unplugged.ts' register/upgrade), and render the mode toggle as a reload link in the chrome carrying the rest of serializeState(). Clean realm per load so the plugged/unplugged gap is honest. Same-document stage retained (the isolation showcase). Size-3 FUI slice, no WE surface.

## Scope

1. **Serialize the mode.** Add a `plug` key (`on`|`off`, default `on`) to the workbench URL state — `serializeState()` / the restore path in `fui:workbench/mount.ts:838-929` already round-trip block/ds/traits/axes/scheme/hc/fc/rtl/locale/cq, so this is one more key.
2. **Branch the boot path** in `fui:demos/workbench.ts`: when `?plug=off`, skip `fui:plugs/bootstrap.ts` and instead drive the functional `fui:plugs/unplugged.ts` `register`/`upgrade` path; default (`on`/absent) boots `bootstrap` as today. Pick the path **before** `mountWorkbench`, since plugged irreversibly patches realm globals — the clean realm comes from the fresh load.
3. **Render the toggle** in the chrome as a reload **link** (`href`), not a JS toggle: `?{withParam(serializeState(),'plug',other)}` so the rest of the state carries across the reload.

## Acceptance

- `?plug=off` renders the block via the unplugged path with no global patch applied; `?plug=on` (or absent) renders plugged as today.
- The toggle is a reload link that preserves all other serialized workbench state across the switch.
- A plugged-only capability visibly differs between the two modes (the gap the workbench exists to show is honest, not faked by lingering globals).
- `check:standards` + workbench e2e green.

## Pre-flight finding (batch-2026-06-27) — `blockedBy: ["1926"]`, dropped `outgrew`/blocked-in-fact

Claimed and grounded; the `?plug=off` half outgrew the size-3 estimate on a **missing prerequisite**, not a
design fork. Two grounding facts:

1. **Plugged is the status quo via a vite auto-inject (premise confirmed).** The `bootstrapPatches()` plugin
   in `fui:vite.config.mts:20-30` injects the `fui:plugs/bootstrap.ts` script into every demo HTML (skips if
   already present), so the workbench is plugged today and `?plug=on` is a no-op — the `?plug=on` branch is
   "skip the workbench page in that plugin / import bootstrap from `fui:demos/workbench.ts`", trivial.
2. **The unplugged half has nothing to drive.** Acceptance bullets 1 + 3 require "render via the unplugged
   path" + "a plugged-only capability **visibly differs**" — but there is **no functional standard-plug
   register-set**: `fui:plugs/bootstrap.ts` couples its realm-global patches to 13 `register*()` calls, and
   `fui:plugs/unplugged.ts` exposes only primitive `register()`/`upgrade()` with **zero non-test importers**
   (no demo drives unplugged). "Drive the unplugged register/upgrade path" has nothing to call until that
   register-set exists.

Filed the prerequisite **#1926** (functional standard-plug register-set / `bootstrapUnplugged()`); repointed
`blockedBy [] → ["1926"]`. This is a real dependency edge, not a forced design call — once #1926 lands, this
item is a clean wire-up (`?plug=off → bootstrapUnplugged()`, skip the vite auto-inject for the workbench
page, render the gap). Released unbuilt (`active → open`).
