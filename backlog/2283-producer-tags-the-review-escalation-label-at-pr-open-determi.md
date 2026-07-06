---
kind: story
size: 3
status: open
relatedTo: ["2281", "2285", "2286", "2262", "2171"]
dateOpened: "2026-07-06"
tags: [review, deterministic-labels, pr-lifecycle]
---

# Producer tags the review-escalation label at PR-open — deterministic, not lazily at drain-sweep

**Principle (user directive, 2026-07-06):** if a PR is going to need a human review, it must carry the
`review:human` label **from the start** — applied by tooling at PR-open, never surfaced lazily only when a
drain happens to sweep it. This is #2281's rule ("a PR's status must *always* be reflected by a label, applied
deterministically by tooling, never inferred from absence") applied to the **review** dimension.

## The gap (observed live on PR #161)

`we:scripts/pr-land.mjs --label-on-green` applies only `ready-to-merge`. The `review:*` classification is
applied **later**, by the drain's escalation rubric (`we:scripts/merge-ai-prs.mjs` → `scoreEscalation` /
`decideReviewGate`) the first time a drain *sweeps* the PR. So a PR that edits a gate-self file (e.g.
`we:scripts/merge-ai-prs.mjs`) sits with NO review label — indistinguishable from a normal ready PR — until a
drain touches it. A human looking at the PR list cannot tell it needs their review. That is exactly the
lazy/implicit anti-pattern #2281 forbids.

## Why the producer CAN do this (the classification is fully deterministic at open)

`we:scripts/lib/review-escalation.mjs` → `scoreEscalation` is a pure function of signals the **producer already
has** at PR-open — none require a drain:
- `changedFiles` → blast-radius + **gate-self / `humanRequired`** (the diff pr-land is landing);
- `diffLines` → size (same diff);
- `dismissedFindings` → the lane's pre-PR review (#2170), which pr-land already composes into the PR body;
- `crossRepo` → the `we:.lane-manifest.json` couple shape pr-land reads;
- `prNum` → the 1-in-N sampling floor — known the moment `gh pr create` returns the number.

## What to build

- In `we:scripts/pr-land.mjs`, after the PR is open + green, run `scoreEscalation(...)` on the diff / manifest /
  prNum and apply the deterministic review label at producer time: `review:human` when `humanRequired`,
  else `review:pending` when `escalate` — alongside `ready-to-merge` (a green producer PR IS ready; the review
  label is the *gate on landing it*, which the drain already honours). Stamp the reasons in the PR body/comment
  like the drain does.
- Make the drain (`we:scripts/merge-ai-prs.mjs`) **read** a pre-applied `review:*` label and honour it (park),
  rather than being the first to apply it. Keep its own `scoreEscalation` pass as an **idempotent backstop /
  reconcile** (#2216 rhyme — the drain applies a label the producer flow was supposed to) so an
  unlabelled-but-should-be PR (opened by an older producer, or a human-pushed lane) is still caught.
  Producer-applied and drain-applied must converge to the same label (same rubric, one shared module).
- Cover with unit tests: a gate-self diff → pr-land applies `review:human` at open; an escalating
  non-gate-self diff → `review:pending`; a leaf diff → no review label; the drain treats a pre-labelled PR as
  already-scored (no double-apply, honours the park).

## Notes / open questions

- **Composition with `ready-to-merge`:** a `review:human` PR still carries `ready-to-merge` (it *is* producer-
  complete + green); the drain's park gate is what withholds the land. Confirm this is the intended pairing
  vs. withholding `ready-to-merge` until `review:accepted` (leaning: keep both — `ready-to-merge` = "producer
  done", `review:*` = "landing gate", two orthogonal facets, per #2281's total-label model).
- Sibling to #2281 (which covers the **CI-state** lifecycle labels — checking/failed/blocked); this covers the
  **review-state** labels at producer time. Could fold under #2285 (negotiated review) as its producer-side slice.
