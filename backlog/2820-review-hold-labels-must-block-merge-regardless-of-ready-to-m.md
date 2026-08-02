---
bornAs: xwtg5zh
kind: story
size: 3
parent: "2527"
status: active
dateOpened: "2026-08-01"
tags: [drain, review, merge, ci-lifecycle, gate]
---

# Review-hold labels must block merge regardless of ready-to-merge (the hold that didn't hold)

Drain merged WE PR #956 while it carried review:changes — ci-lifecycle applies ready-to-merge on green CI independently of review state, and the merger acts on ready-to-merge, so a PR under an unsatisfied review gate can still merge.

## The finding

**Symptom.** WE PR #956 **merged while carrying `review:changes`** — a review gate that should have held it. It landed anyway.

**Root cause — a coexistence bug.** The two label families are not mutually exclusive, and the merge decision reads only one of them:

- The drain's **ci-lifecycle** applies `ready-to-merge` on green CI **independently of review state**. It looks at CI, not at whether a review gate is owed.
- The **merger acts on `ready-to-merge`**. It does not independently check the review labels.

So a PR under an **unsatisfied review gate** — `review:pending`, `review:changes`, or `review:human` — can still merge, because green CI stamps `ready-to-merge` and the merger honors it. The hold and the go-ahead sit on the same PR at the same time, and the go-ahead wins.

**Corroborating.** The main session had to **manually strip `ready-to-merge`** to hold #132, #957, and #959. Even that is **not durable**: the ci-lifecycle reconcile can **re-add `ready-to-merge` on green** while the review gate is still unsatisfied. The manual strip is a race against the reconcile, not a lock. The hold does not reliably hold.

## The fix

Record both. The first is the invariant; the second is defense in depth.

### 1. (Recommended, robust) The merge predicate is the single source of truth

The drain must **refuse to merge any PR bearing an *unsatisfied* review label** (`review:pending` / `review:changes` / `review:human`), **regardless of `ready-to-merge`**.

Merge requires **review SATISFIED** (`review:accepted`, or no review gate owed) **AND** `ready-to-merge` — an **AND**, not an OR on `ready-to-merge` alone. The merge decision reads the review state directly, so no label-timing race can slip a held PR through. This is the durable fix: even if `ready-to-merge` is (re-)applied while a gate is unsatisfied, the merger still refuses.

### 2. (Defense in depth) Mutual exclusivity

Make the two label families structurally exclusive:

- Applying a review-gate label (`review:pending` / `review:changes` / `review:human`) **strips `ready-to-merge`**.
- The ci-lifecycle reconcile **must NOT (re-)apply `ready-to-merge`** while a review gate is unsatisfied.

This keeps the labels honest even for consumers other than the merger, and removes the re-add race that defeated the manual strip. It is a backstop, not a substitute for fix 1 — the merge predicate stays the source of truth.

## Cross-references

- **#2563** — advisory care level / which signals gate a human. Establishes that a review gate is a real hold; this item enforces that hold at the merge boundary.
- **#2439** — non-author clear (the conflict-of-interest invariant on who satisfies a review). A gate is satisfied only by that path, never by a stray `ready-to-merge`.
- **#2421** — the ci-lifecycle labeler that applies `ready-to-merge` on green. This is where fix 2's "do not re-apply while a review gate is unsatisfied" reconcile rule lands.

## Acceptance

- A PR carrying `review:pending` / `review:changes` / `review:human` **cannot be merged by the drain even if `ready-to-merge` is also present**.
- **Reproduce the #956 scenario as the regression case**: a PR with both `review:changes` and `ready-to-merge` is presented to the drain and is held, not landed.
- (Fix 2) Applying a review-gate label strips `ready-to-merge`, and the ci-lifecycle reconcile does not re-add it while the gate is unsatisfied.
