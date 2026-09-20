---
bornAs: xyttg9l
kind: decision
parent: "3054"
status: open
scope: ["we:scripts/review-set-label.mjs", "we:scripts/lib/review-escalation.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# May a review:human approval carry across a push that only merges main into the reviewed branch?

A review:human clearance is revoked by any head move. On web-everything#2347 (2026-09-20) a conflict-fix worker's plain merge commit efa134d33 re-parked an operator-cleared PR and cost a second approval. The content-keyed carry-over already in we:scripts/lib/review-escalation.mjs (acceptanceCoversHead, reviewed-contribution) would NOT have saved it: the conflict resolution changed 8 of the PR's own +/- lines. Decides what, if anything, may carry an approval across a main-merge or conflict-resolution push, and what record and guardrails that needs across we:scripts/review-set-label.mjs and we:scripts/merge-ai-prs.mjs.

## The question

When may a human approval carry across a push that merges main into the reviewed branch?
Should an unchanged contribution get a durable carry-over record, and should a changed resolution get a narrower approval ceremony?
The choice must preserve the scope of what the operator actually approved.

## What happened on #2347

The GitHub API timeline for web-everything PR #2347 on 2026-09-20 shows:

| Time (UTC) | Event |
| --- | --- |
| 13:25:17 | Operator cleared `review:human` through `we:scripts/review-set-label.mjs --to=clear-human`; acceptance stamped `reviewed-sha ed4103e9e` and `reviewed-contribution 8a003b74…`. |
| 13:25:53 | Drain skipped the PR: `mergeable=CONFLICTING`. |
| 14:05:18 | Conflict-fix worker pushed plain merge commit `efa134d33`, titled “Merge origin/main into lane/multi-repo-checks”. |
| 14:13:01 | Drain re-applied `review:human`: acceptance was stale after the head advanced; clearance was revoked and re-clear required. |
| 14:17:38 | Operator re-cleared: “I approve 2347”. |
| 14:18 | PR landed. |

The merge resolved three files:

- `we:docs/agent/testing.md`: kept both sections.
- `we:skills-src/conveyor/runner.mjs`: kept the per-repo loop and restored main's operator-notify pass as a WE-only run.
- `we:skills-src/conveyor/__tests__/runner.test.mjs`: added operator-notify to the expected pass list.

The PR had `blast-radius` and `gate-self` findings, included `we:scripts/review-runner.mjs`, and changed 1420 lines. It needed two approvals; the drain was blocked for roughly 12 minutes between them.

Recomputation on 2026-09-20 with `normalizeContributionFingerprint` establishes the content change:

- Accept-time net diff `5526865e..ed4103e9e` reproduces the stamped `8a003b74` exactly.
- Post-merge net diff `015e18a6..efa134d33` hashes to `686c035c` instead.
- Comparing net `+/-` lines finds 0 only in the old diff and 8 only in the new diff.
- Counts changed from 1065+/347- to 1069+/351-, across the same 52 files.

The conflict resolution changed the PR's own contribution. Today's gate was right to re-park it. Option 2 would not have saved #2347.

## What already carries an approval, and what does not

`acceptanceCoversHead` in `we:scripts/lib/review-escalation.mjs` already checks three routes, in order:
the head SHA matches; `reviewed-diff` is byte-identical; or, last, `reviewed-contribution` is equal.
It reads fingerprints, not actor identity. A worker's plain main-merge push already qualifies when its contribution is unchanged.

The drain additionally re-stamps its own rebases through `restampAcceptance` / `needsAcceptanceRestamp`
in `we:scripts/merge-ai-prs.mjs` and `--to=restamp` in `we:scripts/review-set-label.mjs`.
Channel `drain-rebase` posts “acceptance re-stamped after a rebase (no new review)”.
That path requires `action === 'rebased'` by this drain and a live `review:accepted`, with no review hold.
Its scope is deliberately narrow: an author's push is not this.

`decideSetLabel` in `we:scripts/review-set-label.mjs` already enforces actor independence,
refuses a restamp that would create an acceptance, and writes the comment before the label swap (#2964).
These are existing protections, not new work proposed here.

Two gaps remain: a non-drain main-merge with an identical contribution is honoured silently,
with no durable carry-over record and `reviewed-sha` still naming the old head.
A conflict resolution that touches the PR's own lines always re-parks, however mechanical.

Related cards: #2409 ratified SHA-identity strictness; open #2884 covers drain livelock and acceptance surviving unrelated main traffic.
Resolved #3023 built the contribution escape; resolved #3039 made revocation loud; resolved #3053 settled the stale re-park label.
Digest limits belong to parent #3054: #3021 covers false honour on relocation with unchanged content, hunk lengths and run shape;
#3046 and #3052 cover resolved false-stale cases. This card does not claim the digest proves semantic equivalence.

## Options

### 1. No further carry-over (status quo)

Every contribution change needs fresh operator approval. Identical-contribution honour stays silent. Safe under today's rules, with no new code. A conflict that changes the contribution costs two approvals on a `review:human` PR.

### 2. **Keep content-keyed carry-over, and make it visible + guarded (default; agent recommendation)**

Carry across a new head only when the drain recomputes a `reviewed-contribution` fingerprint
byte-identical to the approved one: the push only brought main's changes in.
Any resolution hunk touching the contribution, extra commit changing it, or other contribution change re-parks.
For non-drain pushes, add a proposed visible carry-over record: a PR comment plus a label event.
Never widen coverage of statute-tier or gate-self paths beyond the original approval.
The honour is mostly existing behaviour; the new work is the record and guardrails.
This makes carry-over auditable but does not remove #2347's second approval or repair digest limits owned elsewhere.

### 3. Carry across any push by the mechanical fixer within N rounds

Rejected as a recommendation: a trusted actor and a round limit do not establish reviewed content.
It could remove the second approval, but would approve content nobody reviewed. The fixer's resolution is exactly the part a reviewer would want to see.

### 4. Delta-scoped re-approval for a conflict-resolution merge

The measurement surfaces this option; it was not in the original brief. It is not the default.
Carry approval over the unchanged part and show only the resolution delta for a proposed one-command operator confirm.
That delta is the `+/-` lines differing from the approved contribution: 8 lines on #2347. It removes the cost of re-reading the whole 1420-line PR, but still needs a human act and a reliable delta presentation.
It overlaps open #3024, where re-park scores the whole PR rather than the uncovered delta.
This is the only option that addresses the changed-contribution shape measured on #2347.

## Guardrails an implementation needs

- The drain / `we:scripts/review-set-label.mjs` path computes the fingerprint from the live net diff.
  Never trust a fingerprint supplied by the fixer or author.
- Write a durable comment with markers before any label change, preserving #2964's order.
  The proposed non-drain record includes a label event; a quiet in-memory honour is insufficient.
- Distinguish carried approval from fresh review with a proposed “approval carried forward” heading and marker,
  following the existing re-stamp pattern. Record the source `reviewed-sha`, destination head and matched contribution.
- After a force-push or rebase, recompute against the new base. Any mismatch or read failure fails closed and re-parks.
- Statute-tier and gate-self coverage must never widen past what the original approval covered.
- Carry-over cannot create an acceptance. Preserve the refusal shape of `--to=restamp`, including review holds.
- The actor-independence check still applies; fingerprint equality does not waive it.

## Definition of done for the RESULT of the decision

These are build criteria for the eventual ruling; they do not assert that a ruling has happened.

- Replay the #2347 commit pair `ed4103e9e` → `efa134d33` and assert the outcome selected by the ruling.
- Test a pure main-merge with an identical contribution: the durable carry-over record exists and the drain honours acceptance.
- Test that a conflict resolution touching the PR's own lines re-parks.
- Test that carried approval never covers a statute-tier or gate-self path absent from the original approval's coverage.
- Test that a force-push with a changed contribution re-parks.
- Test read failure, missing acceptance and actor-independence refusals, plus comment-before-label ordering.

## Done when

1. **Executable** — a vitest run of the proposed test file `we:scripts/__tests__/review-human-carry-over.test.mjs` (proposed, does not exist yet) fails before the ruling's build lands and passes after. It holds the cases in the definition of done above.
2. The ruling is recorded on this card. The review-ceremony guidance in `we:docs/agent/delivery-loop.md` is updated only if the ruling changes behaviour.

## Not decided here

This card does not rule. `preparedDate` is unset; a /prepare pass follows.
