---
kind: story
size: 3
parent: "1831"
status: open
dateOpened: "2026-06-27"
tags: []
---

# custom-states slice A: states= lowering + twin-lag fix + unplugged floor (FUI)

Slice A of #1831. fui:blocks/renderers/component/declarativeComponent.ts — parse states= into ComponentDef.states (mirror defaultAria L101/L43), emit in generateClassSource (L155/L176-177), fix the runtime-twin lag at L217 (wantsInternals drops defaultAria AND states), and add the unplugged setter/getter floor over native CustomStateSet (no enforcement). Clean mirror of default-aria; batchable now (contract #1830 resolved).
