---
kind: story
size: 5
parent: "2094"
status: open
blockedBy: ["2113", "2110"]
dateOpened: "2026-07-02"
tags: [custom-nodes, delimiter-grammar, bundle, handlebars]
---

# Handlebars/Mustache delimiter bundle

Ship the Handlebars/Mustache bundle over the #2074 recipe model (factory shape per the AUTO_DEFINE_FLAVORS precedent, fui:blocks/renderers/auto-define/CustomAutoDefineRegistry.ts): {{x}} expression, {{{x}}} raw output (distinct open), {{#if}}/{{#each}}…{{/…}} name-echo regions, {{!}}/{{!-- --}} hidden comment. {{> partial}} recorded as a pending-#1980 scorecard row, not a blocker. {{else}} mid-marker is the expected model gap — when confirmed, file the mid-region-marker decision card with the evidence. Mustache is the subset, same bundle. Scored via #2113; gap list published as a we:reports/ topic.
