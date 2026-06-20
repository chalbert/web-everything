---
kind: story
size: 3
parent: "1098"
status: resolved
blockedBy: ["1130"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webdirectives/CustomCommentRegistry.ts"
tags: []
---

# webdirectives: CustomCommentRegistry (extends core HTMLRegistry)

New we:plugs/webdirectives/CustomCommentRegistry.ts extends we:plugs/core/HTMLRegistry.ts (localName customComments), upgrade(node) walks SHOW_COMMENT and re-prototypes matched comments + whenDefined (spec we:src/_includes/project-webdirectives.njk:294-308); mirror upgrade-walk of we:plugs/webinjectors/InjectorRoot.ts:453,247. Demo: unit, define+upgrade upgrades a comment and runs connectedCallback.

## Progress

Shipped `we:plugs/webdirectives/CustomCommentRegistry.ts` — the `customComments` registry (extends
`we:plugs/core/HTMLRegistry.ts`, `localName customComments`):

- `define(name, ctor)` pulls the lifecycle hooks off the prototype and resolves pending `whenDefined`s.
- `upgrade(root)` walks `NodeFilter.SHOW_COMMENT` (inclusive of a comment root), re-prototypes each
  comment whose leading token names a registered directive onto its `CustomComment` subclass, seeds an
  empty `options`, and calls `connectedCallback` — idempotent via a `WeakSet`. Mirrors the SHOW_ELEMENT
  upgrade-walk of `we:plugs/webinjectors/InjectorRoot.ts:453,247`.
- `downgrade(root)` runs `disconnectedCallback` and forgets the node; `whenDefined(name)` is a real
  pending Promise resolved on the next matching `define` (spec §4 surface).
- Name *matching* only extracts the leading token; the full `namespace:name` + options grammar is the
  parser registry's job (#1132, sibling) — deliberately not owned here.

Contract note added to `we:plugs/webdirectives/CustomComment.ts`: registry-upgraded directives declare lifecycle hooks as
**prototype methods** (re-prototyping an existing node can't re-run a constructor, so arrow-function
class fields don't survive — the native custom-element upgrade constraint). Unit test
`we:plugs/webdirectives/__tests__/unit/CustomCommentRegistry.test.ts` 8 green (define/get, upgrade reprototype+connect,
unregistered+closing-marker skipped, idempotent, comment-as-root, downgrade re-connect, whenDefined
both paths). WE `check:standards` 0 errors.
