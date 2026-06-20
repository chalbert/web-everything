---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: webcases/caseToVector.ts
tags: []
---

# Value-equality lowering for value-bearing state observables (cases-to-test bridge, B-layer of #1233)

Optional B-layer ratified under #1233-A: for the minority of value-bearing STATE observables (current-value, validity-state, entity-timeline) where reaching != the right value, grow an expected-value slot so the assert-directive lowers to a full value-equality ConformanceVector instead of a reachability one. Three links: authoring requirement then grows an optional expected value; ProtocolObservable (or the directive) gains a place for the literal; the lowering emits a value-equality vector for those observables. Per-observable opt-in layered on the #1162 reachability floor; does NOT apply to event observables (firing IS the value) or value-as-identity observables (invalid-state-announced vs valid-state-announced).

## Progress

Resolved 2026-06-20. Cleared the stale `blockedBy: [1162]` (the reachability floor landed). Implemented the
B-layer across the three ratified links, all WE-resident + dependency-free (the #817/#899 boundary —
contract only, the FUI/plateau driver still executes/judges):

1. **Authoring requirement grows an optional expected value** — `RequirementRecord.then` gains an optional
   `value?: string` in we:webcases/requirementValidator.ts (the authored expected literal).
2. **ProtocolObservable gains the opt-in** — `valueBearing?: boolean` on `ProtocolObservable` (same file)
   marks the value-bearing state minority (current-value / validity-state / entity-timeline). Plus a
   validator **guard**: a `then.value` is rejected unless the resolved observable is `kind: 'state'` AND
   `valueBearing: true` — so a value on an event observable or a value-as-identity (non-valueBearing) state
   observable is a hard error, never silently dropped.
3. **The lowering emits a value-equality vector** — we:webcases/caseToVector.ts `lowerRequirementToVector`
   now emits `{ reached: <observe>, equals: <value> }` (value-equality subsumes reachability) when the
   observable is `valueBearing` state + a `then.value` is authored; otherwise the #1233-A reachability
   floor (`{ reached }` / `{ fired }`) is unchanged. Event observables never value-equality; absent value
   stays reachability (most-flexible default).

No schema change needed — `ConformanceExpectation`'s index signature already carries `equals` (the lowered
vector still passes `assertConformanceSuite`). Tests: +5 in we:webcases/__tests__/caseToVector.test.ts
(value-equality emit, non-valueBearing→reachability, event→fired, no-value→reachability, schema-valid) and
+4 in we:webcases/__tests__/requirementValidator.test.ts (opt-in guard accept/reject×2/reachability-green),
all via synthetic injected registries. 32/32 webcases tests green; gate green.
