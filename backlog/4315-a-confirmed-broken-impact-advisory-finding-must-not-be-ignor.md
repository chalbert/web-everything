---
bornAs: x3dizsl
kind: story
size: 8
priority: high
parent: "4075"
status: open
scope: ["we:scripts/lib/disposition-judge.mjs", "we:scripts/lib/jury-core.mjs", "we:scripts/lib/jury-ledger.mjs", "we:scripts/lib/verdict-totality.mjs", "we:scripts/review-set-label.mjs", "we:scripts/conveyor/run-rating.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# A CONFIRMED broken-impact advisory finding must not be ignored

PR chalbert/web-everything#2835 merged carrying a codex-correctness finding on we:scripts/conveyor/lease-reaper.mjs tagged [CONFIRMED] [impact if unfixed: broken] (git cherry ignores merge commits, so a lane with unique merge-resolution changes can be reclaimed and its work lost) — advisory findings never block today (we:scripts/lib/jury-core.mjs's advisory-lenses-never-block posture, we:scripts/lib/disposition-judge.mjs#proposeDisposition reduces only mandatory lenses). Design: a finding tagged CONFIRMED with impact broken/critical, from ANY seat, holds the land until a mandatory-level reviewer records a block/card/not-real ruling — recorded durably (we:scripts/conveyor/run-rating.mjs or the PR's own review record) rather than silently riding the accept.

## Risks

- Advisory seats exist precisely so a lone reviewer never blocks a land (we:scripts/lib/jury-core.mjs's "assertion-only findings advise and never block" posture, and its "ADVISORY lens's findings ride, they never block the mandatory-accept land" doc). This card must not make an advisory seat itself a blocker — only a CONFIRMED+broken/critical finding routes to a MANDATORY-level reviewer's own ruling, so the hold is enforced by an existing mandatory-tier gate, not by the advisory seat's own verdict.
- Must fail closed without creating a new stall class: a finding awaiting a mandatory ruling needs a bounded, visible hold (e.g. the existing `review:human`/`review:pending` park machinery in we:scripts/review-set-label.mjs) — not a silent hang with no reviewer ever assigned.
- Scope creep risk: this is a design + implementation card, not a decision needing separate ratification — keep the "mandatory reviewer rules block/card/not-real" contract narrow (just the CONFIRMED+broken/critical case), not a rewrite of the whole disposition reducer.

## Test plan (each fails before the change, passes after)

1. A `we:scripts/lib/disposition-judge.mjs` / `we:scripts/lib/jury-core.mjs` unit test: a ledger carrying one ADVISORY finding tagged CONFIRMED + impact broken (or critical), with every MANDATORY lens accepting, currently reduces to auto-accept — assert it instead escalates/holds for a mandatory-level ruling.
2. A test that a mandatory reviewer's recorded ruling (block / file-a-card / not-real) on that finding is durably readable back (wherever it is recorded) and that a `not-real`/`card` ruling then allows the land to proceed while `block` does not.
3. Confirm PR #2835's own finding (see we:scripts/conveyor/lease-reaper.mjs, the CONFIRMED/broken git-cherry finding) would have held under the new reducer, using a replay of that PR's actual ledger as a fixture.

## Tasks

1. Locate the exact reduction point that currently lets an advisory CONFIRMED+broken finding ride (we:scripts/lib/jury-core.mjs's advisory-never-blocks constant, we:scripts/lib/disposition-judge.mjs#proposeDisposition/#redRefute) and add the new escalation branch.
2. Decide and implement where the mandatory reviewer's ruling is recorded (extend the existing PR label/comment record in we:scripts/review-set-label.mjs, and/or we:scripts/conveyor/run-rating.mjs) so it is queryable later, not just a one-off comment.
3. Wire the hold into the existing park mechanism (`review:human`/`review:pending`) rather than inventing a new label.
4. Update we:scripts/lib/jury-core.mjs's own docs (the "advisory never blocks" comments cited above) to state the one carve-out precisely.

## Proof plan (live, before/after)

- BEFORE: replay PR #2835's real ledger (Test plan #3) through the current reducer — it accepts.
- AFTER: the same replay escalates/holds until a mandatory ruling is recorded, and a `not-real`/`card` ruling releases it while `block` keeps it held — demonstrated on the real fixture, not only a synthetic unit test.

## Done when

1. **Executable** — the Test plan #1 unit test, red before this lands, green after.
