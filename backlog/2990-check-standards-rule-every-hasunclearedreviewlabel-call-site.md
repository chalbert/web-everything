---
bornAs: xcyqiis
kind: task
status: open
dateOpened: "2026-08-02"
tags: [review-integrity, check-standards, drain, review, gate]
scope: ["we:scripts/check-standards.mjs", "we:scripts/merge-ai-prs.mjs"]
---

# check-standards rule — every hasUnclearedReviewLabel call site must pass explicit options

review-integrity guard for the 2989 B6 policy-predicate-extracted-without-its-
parameters class in `we:scripts/merge-ai-prs.mjs`.

## Why

`hasUnclearedReviewLabel(labels, { allowPending })` is the shared "is a review
hold live?" predicate. `classifyPr` threads the `--no-review-escalation` waiver
into it via `escalationRelief`; `buildCarrierHealth` called it with NO options, so
the couple gate's `held` disagreed with `classifyPr`'s `held` under the escape
hatch — the WE carrier classified `merge` and landed while its impl deferred
`held`, inverting impl-first/WE-last (the couple lands WE-first). Fixed by
threading the same `escalationRelief`/`label` into `buildCarrierHealth`.

## The guard

A grep/AST-decidable `check:standards` rule: every `hasUnclearedReviewLabel(`
call site in `we:scripts/merge-ai-prs.mjs` (and the plateau-app drain) must pass
an explicit second argument (the options object). A bare single-argument call is
an error — a policy predicate extracted from its decision site must carry its
parameters, or the two copies of the policy silently diverge.

## Acceptance

- The rule fires on a reintroduced bare `hasUnclearedReviewLabel(labels)` call
  and passes on the current tree (~~both call sites pass options~~ — see the
  correction below; there are six, and one is bare).
- 0 new errors on the `check:standards` gate.

## CORRECTION 2026-08-10 — "both call sites" is wrong, and the scope misses the bare one

Counted while preparing
[#3053](/backlog/3053-what-a-stale-acceptance-re-park-does-to-a-cleared-pr-whole-p/),
whose prep instructions name this card as required reading. There are **six**
`hasUnclearedReviewLabel(` call sites in the tree, not two:

| # | site | passes options? |
| --- | --- | --- |
| 1 | [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) `:562` (`classifyPr`) | yes |
| 2 | [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) `:921` (the couple gate) | yes |
| 3 | [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) `:1502` | yes |
| 4 | [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) `:2948` (the bare sweep refusal) | yes |
| 5 | **[we:scripts/pr-land.mjs](scripts/pr-land.mjs) `:399`** (`decideHoldReadyStrip`) | **NO — bare** |
| 6 | [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `:1243` (`readyMergeConflictsWithHold`, internal) | no (internal caller) |

Two defects follow, and the second is the one that matters:

1. **The count.** `we:scripts/merge-ai-prs.mjs` alone holds four call sites. The
   original "both" appears to have been written against `classifyPr` +
   `buildCarrierHealth` only.
2. **The scope.** This card's `scope` is `we:scripts/merge-ai-prs.mjs` (plus the
   plateau-app drain), so the rule as specified **would not fire on site 5** —
   the one production call site that is actually bare today. The Acceptance
   ("passes on the current tree") is therefore true because of a scope gap, not
   because the tree is clean. Widening the rule to all of `we:scripts/` turns it
   red immediately, which is the honest starting state.

Whoever claims this should decide, as part of the build, whether site 6 (an
internal call inside the predicate's own module) is in or out of the rule — a
guard that fires on its own definition site is noise, so it likely wants an
explicit exemption rather than an accidental one.
