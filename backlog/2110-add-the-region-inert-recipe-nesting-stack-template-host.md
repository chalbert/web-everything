---
kind: story
size: 5
parent: "2093"
status: active
blockedBy: ["2104", "1989"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
tags: []
---

# Add the region inert recipe ({#…}{/…} nesting stack → template host)

Add delimiter-keyed region parsing for children:'inert' ({#each items}…{/each}): regionName/regionClose name-echo matching + the nesting match-stack (#2074 Risk 2), materialized onto <template> via the transform path (fui:blocks/view/ViewIfDirective.ts:147-163, fui:plugs/webdirectives/CustomTemplateType.ts:42-68). Boundary markers follow the standard authored open-close grammar per #1989's ruling (one grammar, no separate residue sigil; idempotent under re-claim); coordinate with active #2068.
