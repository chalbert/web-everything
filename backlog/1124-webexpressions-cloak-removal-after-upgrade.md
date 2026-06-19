---
type: idea
workItem: story
size: 2
parent: "1096"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webexpressions: cloak removal after upgrade

After a node upgrades, remove the nearest ancestor [cloak] attribute once its subtree expressions are upgraded — hook we:plugs/webexpressions/CustomTextNodeRegistry.ts:80-136 (spec we:src/_includes/project-webexpressions.njk:247-268,841). Demo: unit, <div cloak>{{x}}</div> loses cloak after upgrade.
