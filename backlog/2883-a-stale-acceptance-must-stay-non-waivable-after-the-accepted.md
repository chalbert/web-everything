---
bornAs: xh3d4ub
kind: story
size: 2
status: open
relatedTo: ["2409", "2423"]
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-08-02"
tags: [gate, review, drain]
---

# A stale acceptance must stay non-waivable after the accepted label is stripped

`applyEscalationRelief` refuses to waive a `staleAcceptance` park, but the drain strips `review:accepted` in the same pass — so the non-waivable condition survives exactly one pass and the operator valve can then waive it.

## The one-pass window

`applyEscalationRelief` (`we:scripts/merge-ai-prs.mjs`) is explicit that the #2409 stale-acceptance re-park is a different concern from a "review never arrived" pending park, and that "the pending-relief valve must NEVER waive it — a fresh look is required".

But the same pass that raises `staleAcceptance` also drops the now-stale `review:accepted` label (the add-first/remove-last block, deliberately ordered so a partial `gh` failure re-triggers the stale check rather than yielding a bare mergeable PR). On the NEXT pass the PR carries only `review:pending`, so `decideReviewGate` never enters the `hasReviewLabel(accepted)` branch, `staleAcceptance` is never raised, and `applyEscalationRelief` sees an ordinary agent-reviewable pending park — which it waives.

So the guard is live for exactly one pass. After that, `--no-review-escalation=<pr>` waives the very thing the guard names as non-waivable.

## Observed

PR #983 on 2026-08-02. After the drain re-parked a valid human acceptance as stale, a scoped `--no-review-escalation=983` waived the park and merged the PR — reported as "agent-reviewable review:pending waived to a merge (#2423)", with no trace of the stale acceptance the previous pass had refused to waive.

The merge itself was correct on the facts (the net patch was proven byte-identical to the accepted tree), but it went through a valve that had explicitly declined that case one pass earlier. The gate did not decide it; the label churn did.

## Why it happens

The non-waivable condition is derived from **transient label state** rather than from the durable evidence, even though the durable evidence exists and outlives the label: the `reviewed-sha` marker is an ordinary PR comment, and `parseReviewedSha` reads it regardless of what labels are present. Only `decideReviewGate`'s control flow makes it unreachable, by consulting freshness solely inside the accepted-label branch.

Note the tension to resolve rather than paper over: making the marker authoritative regardless of labels means a PR that was ever accepted-and-then-rebased stays non-waivable until it is re-accepted. That is arguably the correct reading of #2409, but it removes an escape the operator currently has, so it should be a deliberate call, not a side effect. Cross-check with the sibling question in the companion item on sha-identity-vs-content coverage.

## 2026-08-12 — THE STATED MECHANISM NO LONGER HOLDS, BUT THE CONCERN SURVIVES BY ANOTHER ROUTE

**Read this before building.** This card is agent-ready and its central mechanism is out of date. Do not build
it as written, and do not close it either.

**What is now false.** The premise above — *"the same pass that raises `staleAcceptance` also drops the
now-stale `review:accepted` label"* — describes behaviour that ended with `#x9xqexm`. The drain does **not**
remove `review:accepted` on a re-park. Established four independent ways during #3053 and re-verified by the
independent review of PR #1160:

- `decideReviewGate` is pure and issues no `gh` call, so it cannot drop a label at all.
- The drain's park branch makes exactly two label writes: the hold `--add-label`, and `stripReadyOnPark`, whose
  body removes `ready-to-merge` only ([we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs#L2976)).
- Repo-wide, the live `--remove-label` sites are CI-lifecycle labels, `ready-to-merge` twice, and the
  reviewer's own swap in [we:scripts/review-set-label.mjs](../scripts/review-set-label.mjs#L242).
- A landed invariant pins the absence:
  [we:scripts/lib/__tests__/gate-invariants.test.mjs](../scripts/lib/__tests__/gate-invariants.test.mjs#L612).

So the "one-pass window" is gone: on the next pass the PR carries `accepted + pending`, not a bare `pending`.

**What survives, and it is the same concern by a different path.** `hasUnclearedReviewLabel` refuses the
`accepted + pending` pair by default — but the operator valve does not. Measured 2026-08-12:

| labels | default | with `allowPending` (`--no-review-escalation=<pr>`) |
| --- | --- | --- |
| `accepted` + `pending` | refused | **waived** |

That pair is producible by no sanctioned writer, so it *means* "the drain re-parked a stale accept" — exactly
the state this card says must stay non-waivable. The valve still waives it. The hole this item names is real;
only its explanation was overtaken.

**So the item needs re-deriving, not building or closing.** Its "Definition of done" below still assumes the
strip, and its fourth bullet pins a sequence that can no longer occur.

- A park is treated as a stale acceptance whenever a `reviewed-sha` marker exists and the live head has advanced past it — whether or not `review:accepted` is still on the PR.
- `applyEscalationRelief` refuses that park on every subsequent pass, not just the one where the label was stripped.
- The operator retains a documented way out, and it is named in the refusal message rather than left to be discovered.
- A test pins the multi-pass sequence: accept → head advances → pass 1 re-parks and strips → pass 2 with `--no-review-escalation=<pr>` still refuses.

**Superseded by the 2026-08-12 note above** — the strip no longer happens, so the fourth bullet pins a sequence
that cannot occur, and the first three are written against a label transition that is gone. The surviving
question is narrower: should `allowPending` waive an `accepted + pending` pair, given that pair means a stale
re-park and no sanctioned writer produces it?
