---
kind: story
size: 3
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webdirectives/CustomTemplateDirective.ts"
tags: []
---

# Reconcile fui:plugs/webdirectives UP to WE (contract-anchored)

Audit fui:plugs/webdirectives vs contract+vectors, then port 5 WE-only files (CustomComment*, multiTemplate) + reconcile CustomTemplateDirective (2 diffs) FUI-up.

## Progress

Reconciled `fui:plugs/webdirectives` UP to WE. Two parts:

- **Ported 5 WE-only files** (FUI lacked the comment-directive family entirely):
  `fui:plugs/webdirectives/CustomComment.ts`, `fui:plugs/webdirectives/CustomCommentParser.ts`, `fui:plugs/webdirectives/CustomCommentParserRegistry.ts`,
  `fui:plugs/webdirectives/CustomCommentRegistry.ts`, `fui:plugs/webdirectives/multiTemplate.ts` (byte-identical to WE; imports resolve to FUI's
  `../core/*`). Updated `fui:plugs/webdirectives/index.ts` to WE's full export surface. Ported their 5 unit tests +
  `fui:plugs/webdirectives/webdirectives.unplugged.test.ts`.
- **Reconciled `fui:plugs/webdirectives/CustomTemplateDirective.ts`** to WE's #1174 fix: the base `connectedCallback` is now a
  **prototype method** (was an instance-property assignment in the constructor). A custom element's
  reaction callbacks are read from the prototype at `define()` time, so FUI's instance-assigned callback
  silently dropped `{children}` projection in a real browser (passed happy-dom tests only). Subclasses now
  call `super.connectedCallback()`. Ported WE's updated `fui:plugs/webdirectives/CustomTemplateDirective.test.ts`.

All 6 webdirectives source files byte-identical to WE; FUI webdirectives tests green (66, 1 skipped).
FUI `check:standards` red only on the 2 pre-existing notification/signature-pad catalog errors (stepped over).
