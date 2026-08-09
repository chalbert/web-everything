---
name: grep-every-name-you-cite-in-prose
description: Every symbol, function, file and item id you name in prose gets grepped before you push, or gets dropped — provenance written from memory reads plausible, ships in the past tense, and no compiler checks it.
metadata:
  type: feedback
---

**Before pushing prose, grep every name in it.** Every symbol, function, constant, file path and
item id you assert — and every count — is a claim about the tree that costs one `grep` to check
and a whole review round to miss. If you will not check it, **drop it**: "the reasons walk in
`review-policy.mjs`" is worth more than a confidently-named function that does not exist.

**The failure mode is specific, and it is not lying.** You write the sentence that *ought* to be
true — a function that ought to exist, a prior item that ought to have established the shape, a
sweep that ought to be tree-wide — and ship it **in the past tense** without looking. The substance
around it is usually right, which is exactly why it survives self-review: the sentence is plausible
because *you would have written that function*.

**Where it concentrates:** `leash: spec` files (#2564) and backlog bodies — the artifacts where the
prose **is** the deliverable. Code gets a compiler and a test; a JSDoc header and an item body get
nothing. A "verified:" or "measured:" preface in front of an unchecked claim is the worst form,
because it spends the reader's trust to skip the check.

**Worked example (PR #1112 / `#xonzpym`, Aug 2026).** Four independent review rounds; the technical
substance held up under re-measurement every round; **seven** false citations found across them,
one per round, including `collectOpenItemIds` (no such symbol anywhere), a suite comment asserting
as *verified fact* that only one tree imported a module (a second tree did, in production glue),
`validateTodoMarkerBlock` (the real name is `validateTodoMarker`), and "35 load-time fixtures"
(measured: 15). The `validateTodoMarkerBlock` one landed **inside the item filed to remedy the
previous round's honesty finding**. Per-case correction did not converge — the generator has to be
closed, not the instances.

**How to apply.**
- Grep-then-write, not write-then-hope. For a symbol: `grep -rn '\bname\b'`. For an item id: open the
  file and read its `status`/`kind` — see [[verify-ratified-citation-against-live-status]].
- **Never write a count from memory.** Measure it (`grep -c`) or omit the number.
- Naming something that does **not** exist yet is fine — mark it *proposed*, and never in the past
  tense.
- Grepping proves a name is real, never that the sentence about it is true. "The `appliesTo` walk is
  in a separate block validator" can be false with every symbol in it resolving. The name check is
  the mechanisable half; the claim about behaviour still needs reading the code.
- Same family as [[verify-before-you-claim]] (never report a result off an exit code) and
  [[verify-ratified-citation-against-live-status]] (a "per ratified #NNNN" is a prose claim). The
  sharp axis here is **provenance in authored prose** — the deliverable itself, not a status report.

**Mechanisation:** the name-does-not-exist half is script-decidable and filed as a `check:standards`
gate over prose lines **added** by a change (`#x8918rc`, extending the `#2821` citation-verification
family in `we:scripts/lib/citation-check.mjs`). Measured while filing it: corpus-wide the check is
unusable (1,814 unresolved tokens, dominated by legitimately-proposed names in unbuilt items), but
diff-scoped over PR #1112's own prose it produced **1 finding, the real one, and no false positives**.
Until that lands, this is the discipline — and the residue above stays discipline regardless.
