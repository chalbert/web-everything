---
type: issue
workItem: story
size: 5
parent: "097"
status: open
dateOpened: "2026-06-13"
tags: []
---

# Upgrader version-migration planner — changelog-manifest consumption + version-gated migration selection

Build slice (a) of the ratified #191 version-migration upgrader. Consume the changelog-manifest protocol (#102) as the migration descriptor and add a version-gated planner on #094's upgraderEngine: given installed→target spec versions, select the migration entries in (>installed, <=target], ordered and intermediate-spanning — the Angular `ng update` run loop, mapped onto #266's `compareSpecVersions`/`featureAvailableIn`. Output is an ordered migration plan the transform interpreter (slice b) executes and the input-adapter/mode (slice c) wires into `verifyUpgrade`. Ready now — no open fork (placement + authoring ratified in #191).
