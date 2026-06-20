---
kind: story
size: 2
parent: "1257"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
tags: []
---

# Audit WE runtime for hand-rolled equivalents of newly-shipped ES built-ins

TC39/JS lens: several built-ins reached Stage 4 in 2025-2026 (Iterator helpers, Set methods, using / explicit resource management, Error.isError, Array.fromAsync, RegExp.escape). Audit the WE runtime — notably the webexpressions interpreter — for hand-rolled equivalents and defer to the native built-ins per native-first (#031). Low-priority cleanup. Surfaced by the 2026-06-20 platform-standards watch (#1257), TC39 lens.

## Progress

Resolved 2026-06-20 — **audit complete, no runtime change required.**

**Runtime swept** (we:plugs/**, the WE-repo runtime incl. the webexpressions interpreter
we:plugs/webexpressions/*.ts) for hand-rolled equivalents of each named built-in:
- **Iterator helpers / Array.fromAsync:** none — no `for await` array-collection loops, no manual lazy
  map/filter chains standing in for iterator helpers.
- **Set methods (union/intersection/difference):** none worth deferring. The single Set construction —
  we:plugs/webstates/CustomChangeStrategy.ts:78 `new Set([...Object.keys(a), ...Object.keys(b)])` — is an
  idiomatic key-array *union into a Set*, not a hand-rolled `Set.prototype.union` (which needs two Sets);
  the spread form is clearer, leave it.
- **Error.isError:** no `instanceof Error` guards in the runtime.
- **RegExp.escape:** no hand-rolled escape in the runtime (the webexpressions parsers don't build regexes
  from user strings).
- **`using` / explicit resource management:** the few `try {}` blocks are plain error handling, not
  manual resource-cleanup that `using` would replace.

So the WE runtime is already native-first-clean for these built-ins; nothing to defer.

**Out-of-scope observation (recorded, not changed):** three copies of a hand-rolled `escapeRegExp` live in
BUILD TOOLING — we:scripts/check-standards-rules.mjs:1018, we:scripts/gen-inventory.mjs:66,
we:scripts/autofix/engine.mjs:108. These are `RegExp.escape` candidates, but the repo runs on **Node
22.1.0** where `RegExp.escape` is `undefined` (Node 24+), so deferring them now would break the gate —
correctly stays deferred until the Node floor rises. Build-tooling Set-difference idioms (e.g.
we:scripts/gap-sweep-status.mjs) could use `Set.prototype.difference` (Node 22 has it) but are out of this
item's runtime scope and not worth the churn. No follow-up filed (low-priority, Node-floor-gated).
