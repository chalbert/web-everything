---
kind: story
size: 3
tier: pinned
status: open
scope: ["we:scripts/review-set-label.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-29"
tags: []
---

# A worker PR that discloses a rule deviation parks for the operator automatically

Operator decision 2026-09-29 ~2:40 PM ET: a worker PR that discloses a rule deviation must not auto-merge. Two live cases already happened with no mechanical support for that rule: #2942 merged with a disclosed `WE_LAND_UNVERIFIED` override plus a local full-suite run, and #2945 merged with a soak-waiver instead of a real soak break — both landed on the worker's own say-so, with no forced human checkpoint. Today `we:scripts/review-set-label.mjs`'s `REVIEW_LABEL_TARGETS` is `['accepted', 'changes', 'rearm', 'clear-human', 'restamp']` — there is no `--to=human` verb, so nothing can mechanically force a PR into `review:human` from a body-level disclosure; `review:human` today only ever gets set by hand or by unrelated gate-self logic, never as "this worker admitted it broke a rule."

## Design

Fix direction: a PR body convention — first line `Deviation: <text>` — that tells the human what was deviated from AND gives the review daemon/drain a mechanical trigger to park the PR under `review:human` with that text quoted in the park comment, before any auto-merge path can run. The operator's existing `clear-human` ceremony remains the only way OUT; this item only adds a new, disclosure-driven way IN.

## MVP

- Define the convention: the PR body's FIRST line matching `Deviation: <text>` marks a disclosed deviation.
- Add a `human` target to `we:scripts/review-set-label.mjs`'s `REVIEW_LABEL_TARGETS` (or an equivalent forcing call) that sets `review:human` unconditionally — the mirror of `clear-human`'s "no bypass" character, in the opposite direction: nothing may skip past a disclosed deviation into auto-merge.
- Wire it into the review daemon/drain's reconcile → park path — locating the actual call site is part of this item's own work (candidates live under `we:scripts/conveyor/`, e.g. near the drain's park/reconcile logic; do not assume a file without checking) — so a PR whose body has the `Deviation:` line is parked `review:human` with the deviation text included verbatim in the park comment.
- Tell workers to write the line: add the convention to `we:skills-src/conveyor/delivery-agent-brief.md` so a delivery agent that takes a `WE_LAND_UNVERIFIED`-style override, or discloses any other rule break, knows to put `Deviation: <text>` as the PR body's first line.

## Test plan

- Unit test: a PR body with `Deviation: <text>` as its first line makes the reconcile/park logic emit a `review:human` park with that text in the comment, regardless of any other green/accepted signal on the PR.
- Unit test: a PR body with no `Deviation:` line is unaffected — no behavior change for the ordinary path.
- Fixtures from the two live cases (#2942's `WE_LAND_UNVERIFIED` disclosure, #2945's soak-waiver disclosure) reconstructed as PR-body fixtures, proving both would have parked under the new mechanism.
- `we:scripts/review-set-label.mjs` unit test for the new `human` target itself (labels added/removed, idempotency, refusal shape) matching the existing test pattern for `accepted`/`changes`/`clear-human`.

## Proof plan (soak break)

- Before: replay #2942's and #2945's actual PR bodies through today's reconcile/park logic and show neither would have been mechanically parked — both merged on the worker's own disclosure with no forced checkpoint.
- After: same two bodies through the patched logic — both park `review:human` with the deviation text quoted.
- This is the before/after evidence the "failures improve the product, never manual fixes" doctrine calls for — proof on these two real, already-happened cases, not only on new unit tests.

## Follow-ups

- Once the daemon-side reconcile/park file is located, consider whether other disclosure shapes (not just a first-line `Deviation:`) should also trigger the same park — keep that out of this item's MVP scope.
- Consider surfacing "why this PR is in review:human" (the deviation text) in whatever operator-facing queue/board view already exists, not only in the PR's own park comment.


## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
