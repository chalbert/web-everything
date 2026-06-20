---
kind: task
parent: "1088"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webregistries/CustomElementRegistry.ts"
tags: []
---

# CustomElementRegistry.whenDefined() real promise

Replace the reject-stub at we:plugs/webregistries/CustomElementRegistry.ts:143-152 with a real promise: a pending-resolver map keyed by name, fired from define() when the name is registered. The already-defined fast path (this.has(name)) stays. Slice B of #1088 (we:reports/2026-06-19-backlog-split-analysis.md). Demo: unit test — whenDefined('x') pending → define('x', …) → resolves with the ctor. Shares define() with slice C (#1102) — don't batch in the same concurrent slot.

## Progress

Replaced the reject-stub in `we:plugs/webregistries/CustomElementRegistry.ts` `whenDefined()` with a real
pending promise: a `#whenDefinedResolvers` Map<name, resolver[]> populated when `whenDefined(name)` is
called for an undefined name, and fired from `define(name, …)` the moment that name registers (with the
element constructor). The already-defined fast path (`this.has(name)` → `Promise.resolve`) is unchanged.

Unit test `we:plugs/webregistries/__tests__/unit/whenDefined.test.ts` — 4 green (fast path, pending→define
resolves with ctor, multiple waiters all settle, no longer rejects with the not-implemented error). Mirrors
the same whenDefined pattern shipped in #1131's CustomCommentRegistry. WE `check:standards` 0 errors.
