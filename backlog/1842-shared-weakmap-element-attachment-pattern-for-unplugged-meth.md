---
kind: story
size: 3
parent: "1836"
status: resolved
blockedBy: []
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: frontierui/plugs/core/ElementAttachment.ts
tags: []
---

# Shared WeakMap element-attachment pattern for unplugged method and state

In plugged mode a plug patches methods straight onto the element; unplugged mode must attach behaviour out-of-band, keyed by the element — a WeakMap from element to plug-owned state and methods, consulted by the plug API rather than read off the DOM node. Establish this shared pattern once (ownership, GC semantics, lookup helper) in fui:plugs/ and port one reference plug onto it as the worked example the other unplugged fixes follow.

## Shipped (batch-2026-06-27-1842-1720)

The shared primitive: **`fui:plugs/core/ElementAttachment.ts`** — `class ElementAttachment<V, K extends object = Element>`
wrapping one `WeakMap<K, V>` with `get` / `has` / `set` / `getOrCreate(key, factory)` / `delete`. Documents the
three things the story asked for: **ownership** (one instance per plug-concern, one value kind), **GC semantics**
(the `WeakMap` holds no strong ref to its key, so an element's attachment is collected with the element — no
manual teardown; the bug a plain `Map<Element,…>` carried), and a **lookup helper** (`getOrCreate` runs its
factory only on a miss). Exported from `fui:plugs/core/index.ts`. Key type is generic (default `Element`, widen
to `Node`) so #1858 can key its webcontexts/webinjectors port off `Node`.

**Reference plug ported:** `fui:plugs/webbehaviors/CustomAttribute.ts` — its per-element `CustomAttribute[]`
registration list moved off a module-level `Map<Element, CustomAttribute[]>` (which strong-referenced every host
element forever — a real leak) onto an `ElementAttachment`. `attach`/`detach`/`getAttachedAttributes` rewired;
all 34 existing `CustomAttribute` tests still green, plus 8 new `ElementAttachment` unit tests
(`fui:plugs/core/__tests__/ElementAttachment.test.ts`). This is the worked example #1858/#1856/#1860 follow.

Gate: 155 FUI plug tests pass; the new + ported files are tsc-clean and carry no `check:standards` finding
(the repo's 34 pre-existing `blocks/` tag-parameterization errors + 2 `webexpressions`/`webstates` tsc errors
are unrelated to this changeset — proven by re-running the gate with this change stashed).
