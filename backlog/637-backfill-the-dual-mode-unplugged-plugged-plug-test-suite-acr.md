---
kind: story
size: 8
status: resolved
blockedBy: ["635", "636", "649"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: plugs/webstates/__tests__/unit/webstates.unplugged.test.ts
tags: []
---

# Backfill the dual-mode (unplugged + plugged) plug test suite across all plugs

Author the missing automated tests so every plug proves it works in both unplugged (non-invasive, no window/prototype mutation) and plugged modes, satisfying the #606 dual-mode conformance check. Uses the audit matrix to target gaps and the check rule for the required shape. Brings the whole runtime green under the gate — a precondition for trusting the @frontierui/plugs extraction.

## Blocked-by #649 added (2026-06-15, batch pre-flight)

Claimed in a batch and inspected before any edit. This "backfill across **all** plugs" overlaps with
**[#649](/backlog/649-reconcile-plugs-we-fui-drift-dual-mode-test-backfill-ahead-o/)**, which the dual-mode
gate rule itself names as the backfill owner (`validatePlugDualMode` in `we:scripts/check-standards-rules.mjs`:
*"#649 backfill target"*). #649 reconciles the WE/FUI plug **drift** (porting WE-ahead canonical fixes into
FUI, deciding the two WE-only domains' home) **and** backfills the 3 highest-impact domains' dual-mode tests —
and it is `blockedBy #170` (the reversal). Backfilling all plugs **now**, against the current divergent
`webeverything/plugs/` tree, would write tests twice (or against a copy #170/#658 is about to move/delete).
So this item depends on the reconciliation landing first: `blockedBy #649` added. Once #649 reconciles the
trees + backfills the highest-impact set, #637 is the **remaining** domains' backfill, after which
`PLUG_UNPLUGGED_TEST_ENFORCED` flips to `true` (the #636 gate-promotion noted in #649). Not a design call —
a factual DAG correction grounded in the #635 audit + the gate rule's own owner designation. Released to the
pool unworked.

## Progress (2026-06-15, batch-2026-06-15)

After #649 resolved, the remaining domains warning under `validatePlugDualMode`
([we:scripts/check-standards-rules.mjs](../scripts/check-standards-rules.mjs)) were six: `webcontexts`,
`webdirectives`, `webexpressions`, `webstates` (stable shared domains) plus `webguards`, `webvalidation`.

**Backfilled the four stable domains' unplugged-mode tests** (the gate detects an `*.unplugged.test.ts`
that imports the non-invasive surface and exercises the domain):
- [we:plugs/webstates/__tests__/unit/webstates.unplugged.test.ts](../plugs/webstates/__tests__/unit/webstates.unplugged.test.ts)
  — scoped `CustomStoreRegistry` define/get, a store run as a plain library (state/subscribe/unsubscribe),
  two registries independent (webstates patches no global).
- [we:plugs/webcontexts/__tests__/unit/webcontexts.unplugged.test.ts](../plugs/webcontexts/__tests__/unit/webcontexts.unplugged.test.ts)
  — asserts `isPatched()` stays false and `Node.prototype.contexts` is absent (the `Node.contexts` patch
  is never applied), plus scoped define/get + plain context value get/set/has.
- [we:plugs/webexpressions/__tests__/unit/webexpressions.unplugged.test.ts](../plugs/webexpressions/__tests__/unit/webexpressions.unplugged.test.ts)
  — scoped `CustomTextNodeRegistry` define/get, a `CustomTextNode` subclass constructed as a plain `Text`
  node (clone handlers never registered), two registries independent.
- [we:plugs/webdirectives/__tests__/unit/webdirectives.unplugged.test.ts](../plugs/webdirectives/__tests__/unit/webdirectives.unplugged.test.ts)
  — static/deterministic: `CustomTemplateDirective` extends native `HTMLTemplateElement`, a subclass
  derives with both chains intact, and the native `HTMLTemplateElement.prototype` carries no bolted-on
  lifecycle (non-invasive). (Constructing a customized built-in needs `customElements.define`, a global
  registry mutation, so the unplugged proof is the no-patch shape, not a `new`.)

**13 tests green; WE `check:standards` unplugged warnings 30 → 26** (only `webguards`/`webvalidation`
remain).

**`webguards` + `webvalidation` are deferred to [#725](/backlog/725-port-we-only-plug-domains-webguards-webvalidation-their-subs/), not this item.** They are mid-port
to FUI (#725, itself blocked on the #730 placement fork); authoring their dual-mode tests in WE now would
duplicate the FUI-side `vitest green` verification #725 must do, against a tree #449 will delete. So #725
owns their dual-mode backfill (its scope already requires verifying the ported domains green). The
`PLUG_UNPLUGGED_TEST_ENFORCED` → `true` flip therefore waits on #725 landing — flipping now would turn the
two remaining warnings into a red gate. Resolved: the stable-domain backfill is complete; the residual is
tracked on #725, not left untagged.
