---
kind: story
size: 2
parent: "1098"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webdirectives/CustomComment.ts"
tags: []
---

# webdirectives: CustomComment base class (extends native Comment)

New we:plugs/webdirectives/CustomComment.ts — abstract base extending Comment with optional connectedCallback/disconnectedCallback/optionsChangedCallback + readonly options (spec we:src/_includes/project-webdirectives.njk:243-256); mirror the non-invasive pattern of we:plugs/webdirectives/CustomTemplateDirective.ts:46-130; export from index. Demo: unit proves prototype chain extends Comment and patches nothing.

## Progress

Shipped `we:plugs/webdirectives/CustomComment.ts` — the abstract comment-node directive base (the
comment analog of `CustomTemplateDirective`): extends the native `Comment`, holds `readonly options`,
and declares the three optional lifecycle hooks (`connectedCallback`/`disconnectedCallback`/
`optionsChangedCallback`) the `customComments` registry invokes. Non-invasive (patches no global, per
#606), spec `we:src/_includes/project-webdirectives.njk`. Exported from `we:plugs/webdirectives/index.ts`.
Unit test `we:plugs/webdirectives/__tests__/unit/CustomComment.test.ts` (6 green): prototype chain
reaches Comment→CharacterData→Node, options held, native comment data carried, hooks optional, and
`Comment.prototype` gains no members (patches nothing).
