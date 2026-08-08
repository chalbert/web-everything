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
  and passes on the current tree (both call sites pass options).
- 0 new errors on the `check:standards` gate.
