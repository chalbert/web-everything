---
kind: story
size: 3
status: open
parent: "1836"
blockedBy: []
dateOpened: "2026-06-27"
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
