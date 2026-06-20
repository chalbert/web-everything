---
kind: story
size: 3
status: open
blockedBy: ["1162"]
dateOpened: "2026-06-20"
tags: []
---

# Value-equality lowering for value-bearing state observables (cases-to-test bridge, B-layer of #1233)

Optional B-layer ratified under #1233-A: for the minority of value-bearing STATE observables (current-value, validity-state, entity-timeline) where reaching != the right value, grow an expected-value slot so the assert-directive lowers to a full value-equality ConformanceVector instead of a reachability one. Three links: authoring requirement then grows an optional expected value; ProtocolObservable (or the directive) gains a place for the literal; the lowering emits a value-equality vector for those observables. Per-observable opt-in layered on the #1162 reachability floor; does NOT apply to event observables (firing IS the value) or value-as-identity observables (invalid-state-announced vs valid-state-announced).
