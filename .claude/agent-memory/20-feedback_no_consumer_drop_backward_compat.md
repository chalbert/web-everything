---
name: feedback_no_consumer_drop_backward_compat
description: "zero real callers ⇒ no backward-compat owed; grep the consumer graph, then drop the dead shim, don't rename around it;"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1552f65c-40f8-4991-8221-48fe4a7dd27a
---

When a backward-compat artifact (a retired-form alias, a deprecation redirect, a legacy id) has **zero
real callers**, it is dead weight — **drop it**, don't design around it (e.g. don't rename a colliding id
to dodge it). No consumer ⇒ no backward-compat obligation.

**Why:** in #1619 I leaned "keep the `functional` id as-is (status quo, don't churn)" and floated a
`functional-authoring` rename to avoid cross-catalog confusion with FUI's retired `functional` wrapper
alias. The user reframed it: we have no consumer yet, so there's no point keeping backward compatibility.
A consumer-graph grep confirmed the alias had zero real callers (only its own deprecation tests), so the
clean move was to remove the shim at source — which dissolved the rename question entirely.

**How to apply:** before preserving or working around any backward-compat shim, **grep the consumer
graph first** ([[feedback_prep_verify_mechanism_has_consumer]]). Zero callers → file its removal, don't
accommodate it. This is a private solo project, so "demand/adoption" is never the test
([[feedback_judge_on_pure_merit_never_demand]]); likewise an *imagined* future caller is not a real one.
Codified in `docs/agent/platform-decisions.md#authoring-form-id-distinct-from-consume-wrapper`.

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#authoring-form-id-distinct-from-consume-wrapper` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
