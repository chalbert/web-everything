---
type: idea
workItem: story
size: 3
parent: "1098"
status: open
blockedBy: ["1130"]
dateOpened: "2026-06-19"
tags: []
---

# webdirectives: CustomCommentRegistry (extends core HTMLRegistry)

New we:plugs/webdirectives/CustomCommentRegistry.ts extends we:plugs/core/HTMLRegistry.ts (localName customComments), upgrade(node) walks SHOW_COMMENT and re-prototypes matched comments + whenDefined (spec we:src/_includes/project-webdirectives.njk:294-308); mirror upgrade-walk of we:plugs/webinjectors/InjectorRoot.ts:453,247. Demo: unit, define+upgrade upgrades a comment and runs connectedCallback.
