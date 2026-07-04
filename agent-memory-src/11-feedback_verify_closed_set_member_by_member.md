---
name: feedback_verify_closed_set_member_by_member
description: "a \"closed at N\" set claim must be checked against EACH real subject before ratifying; closure is the easiest overclaim"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8bc0451d-325a-4f5a-b728-7092f5d2fa1f
---

When a decision asserts a **closed / exhaustive set** ("the matcher vocabulary is closed at three", "these are the only members"), verify it **member-by-member against each concrete subject's real return type/output** before ratifying — do not trust the count from the survey.

**Why:** closure is the easiest overclaim to slip past prep. In #1816 the prepared default said the non-verdict conformance matcher set was closed at three `{exact · deep-equal · resolved-options/parts-structure}`; the red-team checked each of the four real runtimes and found two it didn't cover — analytics methods return `void` (predicates over a call log, not deep-equal) and `Intl.Collator` has no `formatToParts` (sign/order, not parts-structure) — forcing a fourth `predicate` member. The set was wrong precisely where it claimed to be complete.

**How to apply:** when red-teaming or preparing a closed-vocabulary fork, make "is it really closed at N?" the **first** skeptic attack — enumerate every concrete subject the set must cover and trace each to its actual type/shape ([[feedback_decision_concrete_code_refs]]). A skeptic finding here usually LANDS (unlike the usual hypothesis-to-test, [[feedback_skeptic_finding_is_a_hypothesis]]). Distinct from [[feedback_vocabulary_completeness_early]] (design the full set up front when prior art settles it) — this is the verification that the claimed-full set actually is.
