---
kind: story
size: 3
parent: "2093"
status: open
blockedBy: ["2104"]
dateOpened: "2026-07-02"
tags: []
---

# Comment-grammar bridge — CustomCommentRegistry materializes invisible customNodes recipes

Bridge the comment grammar as the invisible recipes' pre-JS-invisibility authoring form (#2074 Risk 1): the CustomCommentRegistry walk (fui:plugs/webdirectives/CustomCommentRegistry.ts:50-117) reads customNodes definitions authored as <!--@… -->, keeping #1986's registry the polyfill instance the statute-overlap ruling names it. No-flash fixture + tests.
