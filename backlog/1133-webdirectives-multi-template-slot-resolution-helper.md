---
type: idea
workItem: task
parent: "1098"
status: open
blockedBy: ["1131"]
dateOpened: "2026-06-19"
tags: []
---

# webdirectives: multi-template slot resolution helper

A bounded helper (we:plugs/webdirectives/multiTemplate.ts) collecting the <template slot=...> set inside a CustomComment open/close boundary into a Map for a multi-template directive to stamp (spec we:src/_includes/project-webdirectives.njk:134-209,452-459). Subsystem affordance only. Demo: unit, a 4-slot comment region returns a 4-entry slot map.
