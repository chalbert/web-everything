---
kind: story
size: 5
parent: "1442"
status: resolved
blockedBy: ["1457"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: frontierui/blocks/tabs/TabsElement.ts
tags: []
---

# Convert tabs to we-tabs element (persistent light-DOM B) over retained TabGroupBehavior + CEM

Per #1457 (element-over-behavior, can-do/is-a): give tabs its styled is-a form. Add a persistent light-DOM we-tabs element (B-family) hosting the existing fui:blocks/tabs/TabGroupBehavior.ts CustomAttribute kernel, carrying FUI styling and a CEM surface (the #463/#855 framework-flavor generation target). Retain the tab-group behavior as the headless can-do capability (attach to author markup). Triggers/panels stay light-DOM ([tab-trigger]/[tab-panel]), never shadowed; in-leak isolation via #1349 webisolation. Codified in we:docs/agent/block-standard.md §7.

## Progress

Landed (impl → frontierui, contract → webeverything; locus field was missing, added):
- `fui:blocks/tabs/TabsElement.ts` — new persistent light-DOM `<we-tabs>` element (B-family, mirrors `fui:blocks/stepper/StepperElement.ts`). Hosts the existing `TabGroupBehavior` **CustomAttribute** kernel via its registry-free attach path (`new TabGroupBehavior({name:'tab-group'})` → `.attach(this)` → `.isConnected=true` → `connectedCallback()`), carries FUI light-DOM styling under the `we-tabs` scope class (no shadow; #1349 S1), and surfaces the CEM attributes the kernel reads off its owner element (`activation`, `orientation`, `default`) + an `activate(name)`/`activeTab` accessor. `[tab-trigger]`/`[tab-panel]` stay light-DOM children; a live attribute change tears down (removes the prior listeners) then rebuilds. Idempotent overridable-tag `registerTabs(tag='we-tabs')` (#841).
- `fui:blocks/tabs/index.ts` — re-export `TabsElement`/`registerTabs`/`WE_TABS_CSS`.
- `we:src/_data/blocks/tabs.json` — added `TabsElement` + `registerTabs` to `exports` (implementedBy stays the `fui:blocks/tabs/index.ts` barrel).
- `fui:blocks/__tests__/unit/tabs/TabsElement.test.ts` — 6 cases (idempotent register, host-on-connect ARIA + first tab, activate by name, default attr, orientation reflected, light-DOM/no-shadow). Tabs suite 41/41; both gates `check:standards` 0 errors.
