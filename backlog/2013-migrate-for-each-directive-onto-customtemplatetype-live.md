---
kind: story
size: 3
parent: "1994"
status: open
blockedBy: ["2012"]
dateOpened: "2026-07-01"
tags: []
---

# Migrate for-each directive onto CustomTemplateType (live)

Slice C of #1994, blockedBy #2012. Convert ForEachBehavior off CustomAttribute onto CustomTemplateType (typed `<template>`, registered by type value per #1993: items='… as …' + bare key). Move #private init into connectedCallback (chunk-2 re-prototype constraint). Drop registerForEach's define. for-each is the only live directive of the three (registerForEach at fui:plugs/bootstrap.ts:295 + fui:plugs/bootstrapUnplugged.ts:193); with slice B's activation live, migrated for-each keeps working across all upgrade/insertion-cascade sites. Land only after B — dropping the CustomAttribute define without live customTemplateTypes activation silently, gate-invisibly breaks live for-each.
