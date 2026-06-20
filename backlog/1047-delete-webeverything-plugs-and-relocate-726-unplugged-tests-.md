---
kind: task
parent: "170"
status: open
locus: webeverything
blockedBy: ["1234"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
tags: [plugs, dedup, migration, webeverything, frontierui]
---

# Delete webeverything/plugs and relocate #726 unplugged tests to FUI

After WE repoints onto `@frontierui/plugs` (#449): delete the 156 files under `we:plugs/`; relocate the two #726 unplugged tests (`we:plugs/webguards/__tests__/unit/webguards.unplugged.test.ts` + the webvalidation equivalent) to the FUI canonical home (`fui:plugs/webguards/` + `fui:plugs/webvalidation/`, adjusting the `guard/`→`fui:blocks/guard/` and `validity-merge/`/`validator-resolution/` import paths) so coverage is not dropped; verify no `../plugs/` or `@we/plugs/*` reference survives in any repo. All gates green. Bounded cleanup slice of #449.

## Blocked-in-fact (batch-2026-06-19 close-out) — the #449 repoint did NOT actually land

Although #449 is marked `status: resolved`, the WE tree has **not** repointed onto `@frontierui/plugs`: that package is absent from `we:package.json` and `we:node_modules`, and `we:blocks/*` + `we:src/*` still import heavily from the local `we:plugs/` (207 files present, including the actively-built webportals slices #1148/#1149/#1150). Deleting `we:plugs/` now would break the entire WE build. The real prerequisite (a working `@frontierui/plugs` consumed by WE) is verified absent, so this stays blocked regardless of #449's status. **Surfaced for the user: reconcile #449 — it appears resolved-on-paper but the repoint is incomplete.** Do not run this deletion until WE genuinely imports plugs from FUI.
