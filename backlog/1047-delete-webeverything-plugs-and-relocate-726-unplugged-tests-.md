---
type: issue
workItem: task
parent: "170"
status: open
locus: webeverything
blockedBy: ["449"]
dateOpened: "2026-06-19"
tags: [plugs, dedup, migration, webeverything, frontierui]
---

# Delete webeverything/plugs and relocate #726 unplugged tests to FUI

After WE repoints onto `@frontierui/plugs` (#449): delete the 156 files under `we:plugs/`; relocate the two #726 unplugged tests (`we:plugs/webguards/__tests__/unit/webguards.unplugged.test.ts` + the webvalidation equivalent) to the FUI canonical home (`fui:plugs/webguards/` + `fui:plugs/webvalidation/`, adjusting the `guard/`→`fui:blocks/guard/` and `validity-merge/`/`validator-resolution/` import paths) so coverage is not dropped; verify no `../plugs/` or `@we/plugs/*` reference survives in any repo. All gates green. Bounded cleanup slice of #449.
