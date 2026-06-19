---
type: idea
workItem: story
size: 2
parent: "1098"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webdirectives: CustomComment base class (extends native Comment)

New we:plugs/webdirectives/CustomComment.ts — abstract base extending Comment with optional connectedCallback/disconnectedCallback/optionsChangedCallback + readonly options (spec we:src/_includes/project-webdirectives.njk:243-256); mirror the non-invasive pattern of we:plugs/webdirectives/CustomTemplateDirective.ts:46-130; export from index. Demo: unit proves prototype chain extends Comment and patches nothing.
