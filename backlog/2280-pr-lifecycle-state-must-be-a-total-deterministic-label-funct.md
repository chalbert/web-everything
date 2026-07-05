---
kind: story
size: 3
status: open
dateOpened: "2026-07-05"
tags: []
---

# PR lifecycle state must be a total, deterministic label function (no implicit unlabelled states)

**Principle (user directive, 2026-07-04):** a PR's status must *always* be reflected by a **label**, and
each label must be applied **deterministically by tooling** — never inferred from the *absence* of a label,
never a human judgment call. If a PR needs review, it carries a review tag; if its checks are still running,
it carries a running tag; if it is blocked, it carries a blocked tag. "Read the state off a label" must be a
total function over the PR's lifecycle.

## Where we are (after #2262/#2279)

The label set is partially built and already deterministic where it exists:
- `ready-to-merge` — producer-complete, CI green → a drain may land it. Applied by `pr-land --label-on-green`
  (`we:scripts/pr-land.mjs`) only once the required `test` check passes (#2199).
- `review:pending` — the deterministic escalation rubric (#2171) parked this PR for an independent review.
- `review:accepted` / `review:changes` — the reviewer verdict that releases or bounces the park (#2262).

## The gap — three lifecycle states are still IMPLICIT (an *unlabelled* PR)

An unlabelled PR today ambiguously means one of:
1. **CI still running** — `pr-land` opened the PR and is waiting on the required check; not yet labelled.
2. **CI red / needs author fix** — a check failed; `pr-land` deliberately leaves it *unlabelled* for the
   author to fix (never handed to the drain). This is the "unlabelled = don't land" convention — but it is
   an *absence*, exactly what this item forbids.
3. **Blocked by an unlanded `blockedBy`** — the item's manifest carries a cross-item `blockedBy` the drain
   must honor; today that lives only in `we:.lane-manifest.json`, invisible as a PR label.

Because these three collapse to the same "no label" signal, neither the drain nor a human can distinguish
"still checking" from "failed, needs a human" from "blocked on another PR" without re-deriving it from CI /
manifest state — the non-determinism this directive kills.

## What to build

Add the missing lifecycle labels and wire the transport so **exactly one** lifecycle label is always present
on an open AI PR, transitioned deterministically:
- mint the new labels in the same idempotent `gh label create` step that already mints `ready-to-merge` +
  `review:*` (the `/workflow` Provision step and/or a one-shot in `pr-land`/the drain — the #2216 rhyme);
- have `pr-land` set the "checking" label on open, swap it for `ready-to-merge` on green or the "failed"
  label on red (instead of leaving it bare);
- surface a manifest `blockedBy` as the "blocked" label so the drain's skip is visible;
- the drain (`we:scripts/merge-ai-prs.mjs` / `we:scripts/lane-drain.mjs`) reads the label, never label-absence.
Cover the transition table with unit tests so the "exactly one lifecycle label, deterministically set"
invariant is enforced, not conventional.

## Open fork (needs a call before build — do not resolve inline)

The **label taxonomy + granularity** is a design choice:
- **(a) [recommended default]** tag only the *terminal / actionable* states — add `ci:failed` (or
  `needs-fix`) and `blocked`; treat "CI running" as the one legitimately-transient bare state (a PR with no
  lifecycle label = checks in flight, by definition), so we don't churn a label on every check tick.
- **(b) total coverage** — also add `checking` (or `ci:running`) so there is *literally* no unlabelled
  lifecycle state, at the cost of a label write/delete per open + per check transition.
Also settle the names (`ci:failed` vs `needs-fix`, `blocked` vs `blocked:deps`) and whether these compose
with `review:*` (a PR can be both "blocked" and "review:pending") or are mutually exclusive.

Relates to #2262 (review labels this generalizes), #2171 (the review rubric), #2216 (the drain label-reconcile
pass — "the drain applies a label the producer flow was supposed to"), #2199 (label-only-on-green).
