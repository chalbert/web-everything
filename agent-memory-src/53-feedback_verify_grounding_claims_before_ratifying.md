---
name: feedback_verify_grounding_claims_before_ratifying
description: "Before endorsing a prepared decision's default, trace its grounding claims (precedents, contract-vs-impl placement) to the real tree — don't inherit assertions; a running handler is impl, never a WE \"reference\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 156a39d0-4b46-4883-b232-74b0ae8975ca
---

Before ratifying a decision item's recommended default, **verify the claims it rests on against the
real tree** — a prepared item's bold default inherits any error in its grounding, so don't trust its
assertions as facts. Two checks that catch the common miss:

1. **Precedent citations** — open the cited code and confirm it says what the item claims. (#730's C1
   default leaned on "MaaS `serve()` lives in WE"; tracing it, the MaaS serve handler is in the *impl*
   layer `blocks/renderers/module-service/`, NOT a WE plane — the precedent argued the opposite, and C1
   collapsed once traced.)
2. **Placement/classification claims** against the guiding principle — a "pure reference handler →
   WE" classification is a contract-vs-impl call. The test: code that **defines** a contract/conformance
   → WE; code that **delivers** a capability (a registry-dispatching, artifact-producing handler) → FUI
   (see [[feedback_impl_is_not_a_standard]]). A running handler is impl; "it's small/pure/reference"
   does not make it a standard.

**Why:** in #730 I endorsed C1 (keep `service.ts`'s handler in WE) on the item's own framing; the user
caught that it was implementation in the standards repo. I should have caught the layer violation on
first read, not after the push.

**How to apply:** during the fork-readiness pass (codified in backlog-workflow.md), trace each
load-bearing claim before forming a stance; where a traced claim is wrong, fix the fork's default + its
rationale in the item before presenting. Sharpens [[feedback_decision_concrete_code_refs]] (refs must
exist AND be verified, not just cited) and [[feedback_test_before_asserting_cause]] (probe before
asserting). Related: [[project_npm_scope_mirrors_layer]].

**Your OWN memory summary is a claim to trace, not a fact (2026-06-17, #855).** I cited #463 as
precedent that "WE publishes generation adapters" — straight from my [[project_polyglot_reach_forward_adapters]]
memory — to defend a default. The user pushed ("WE = contracts/protocols only"); tracing the actual
items reversed it: #507 builds the adapter **"(own repo)"** *outside* `@webeverything`, WE owns only
the contract (#505) + conformance (#506). A compressed memory line ("reach via forward/generation
adapters") had dropped *where the adapter lives*, and I inherited the lossy version. **When a decision
leans on a precedent you "remember," open the cited items before asserting — the memory may be a lossy
projection of a ruling whose load-bearing detail is exactly what you dropped.** Ruling:
[[project_generator_is_tool_not_we_standard]].

**Ground the STANDARD layer before the impl tree (2026-06-23, #1621).** Before a decision maps any
domain vocabulary or set of surfaces onto a component, search the standard layer FIRST: grep
`src/_data/intents/` (the intent registry) and `docs/agent/platform-decisions.md` (ratified statute,
[[project_platform_decisions_statute_layer]]) for an intent or decomposition that already owns that
vocabulary — only THEN look at the FUI impl tree. For a platform whose product *is* the standard, the
intent/statute layer is upstream of any component, so grounding in impl while skipping it produces
recommendations that contradict ratified decisions. On #1621 this fired twice: a *prepared* default
(put backlog taxonomy pills on the status `badge` via a docs-modifier class) re-conflated exactly what
#1319 (`decompose-overloaded-vocabulary-by-semantic-source`) had split into the **Status Indicator**
(lifecycle) / **Tag** (categorical) / **Notification Marker** (count) intents; and a "no planned tag
component" claim made off `ls frontierui/blocks` missed the existing `tag` intent. Both = impl checked,
standard skipped. A `badge`/pill/label/status/chip/tag mapping in particular → grep intents + statute
before recommending.
