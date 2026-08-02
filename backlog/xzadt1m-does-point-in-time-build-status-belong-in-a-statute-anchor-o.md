---
kind: decision
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, statute, governance, authoring, anchor-shape]
---

# Does point-in-time build status belong in a statute anchor, or on the decision item?

A ratified rule is timeless; what is built so far is not. PR #982 put both in the same anchor, and the result is a
655-word rule (doc median 324) whose sentences go false when #2785 lands. Decide where build status lives: inside the
anchor that states the rule, or on the decision item and the open guards. The call also fixes the shape of #2849,
which currently *requires* such prose to name a retiring item — institutionalising it rather than resolving it.

## Why this is open rather than a fix

The reviewer created the tension. Round 2 of the human `/review` on **PR #982** raised two findings — M8 (the anchor
granted the loop clearing authority while conceding its precondition was absent) and M9 (#2771's narrowing is unbuilt
and undisclosed) — and asked for honesty about what is unbuilt. The author read "be honest" as "disclose in the
anchor", which is a defensible reading of the ask. Round 3's simplicity lens then read the result as a layering
violation. Both are right about their half, so this is a genuine fork, not an author error to bounce back.

## The evidence

Measured against `we:docs/agent/platform-decisions.md` on `main` @ `a6ac95e9`:

- `#fix-review-convergence-independent-root-cause` is **655 words** (corpus median 324, p90 633 — top ~8% of 108
  anchors) and grew 427 → 655 (**+53%**) in the round asked to CUT duplication.
- Its invariant 1 is a single **277-word** paragraph. The longest paragraph in each anchor it cites:
  `#review-human-declarative-leash-only` 149, `#agent-convergence-independent-validation` 149,
  `#contract-split-for-tier-ownership` 126, `#small-file-preference` 179.
- Build-status tokens across the ~1,588 added words: `today` 3, `not yet` 4, `status: open` 2, `status: active` 4,
  `build-pending` 1, `still parks` 1, `interim` 4, `owed` 9, `outstanding prevention` 5. The whole pre-existing file
  (108 anchors) has `today` 12, `not yet` 3, and **zero** occurrences of `status: open`, `build-pending`, or
  `outstanding prevention` in any anchor body.

## Fork 1 — where does build status live?

- **(a) On the decision item and the open guards; the anchor states only the rule.** *(bold default)* The anchor is
  cite-able authority and should read the same in a year. Build status is exactly what the backlog already tracks,
  and every reader who needs it has the item id. Cost: an anchor can state a rule that is not yet enforced with no
  in-place warning — mitigated by requiring a link to the enforcing item, which is what #2844 clause 3 already asks
  for.
- **(b) Inside the anchor, as PR #982 does.** A reader citing the rule sees immediately that it is not in force.
  Cost: the anchor goes stale silently, and this is what produced the 277-word paragraph.
- **(c) A dedicated machine-readable field** — e.g. an `enforced: pending #NNNN` marker the statute gate parses and
  renders, so status is structured rather than prose. Highest cost, and it needs the `/rules/` renderer to change.

## Fork 2 — what should #2849 be?

#2849 as filed requires an anchor's temporal claim to name the open item that retires it. Under option (a) that is
backwards: the lint should **error** on build-status tokens in an anchor body and direct them to the item, keeping
the retiring-item pointer only for the narrow "until #NNNN" case. Note also that #2849's token list (`today`,
`not yet`) would hard-error the ~15 pre-existing uses on `main` unless it ships an exemption list — so #2849 needs
this call before it can be built either way.

## Prevention (whichever fork wins)

An anchor-shape lint in `we:scripts/lib/validate-rules-anchors.cjs`: **error** when a single paragraph or numbered
list item in an anchor body exceeds ~200 words; **warn** when a whole anchor exceeds the corpus p90 (~630 words).
Both thresholds are computable from the file itself, so the gate self-calibrates as the corpus grows. This is
independent of the fork — a rule that cannot be quoted in one sentence gets cited by title from memory instead of
from text, which is the exact failure mode all four #982 review rounds kept finding.

## Provenance

Round-3 finding **R4** from the human `/review` on **PR #982**, raised by the simplicity lens with measurements.
Accepted over at ratification and filed as a decision because the layering call is a genuine fork and the reviewer
owns part of the pressure that created it. Related: #2849, #2850, `x2vqz2v` (the duplication lint), #2844.
