---
bornAs: xpfuj64
kind: decision
tier: pinned
parent: "3383"
status: open
dateOpened: "2026-09-01"
tags: []
---

# Make review acceptance mechanical from a clean independent verdict, not human-gated

Today `review:accepted` can only ever be recorded by a human — an unattended dispatched reviewer, however
independent, may never clear it itself. The actual gate, verified, not assumed: ONE line in the function
`reviewLoopAutoConfirm`, in `we:scripts/lib/review-loop-policy.mjs` — `if (run?.verdict?.verdict ===
VERDICTS.ACCEPT) return null;` — whose own docblock already says "this is the one line in this file that must
never change without a fresh ruling," encoding the operator's own prior 2026-08-31 ruling under this same epic.
That prior ruling is exactly what this decision revisits. (An earlier draft of this card cited the function
`decideSetLabel`, in `we:scripts/review-set-label.mjs`, instead — checked and wrong; that file records a
verdict already decided elsewhere, it does not decide whether an unattended run may act on an accept.
Corrected before landing, per the operator's own "verify" instruction.)

The operator, 2026-09-01, mid the epic's own live-fire test (real independent verdicts landing on real PRs all
night): "I want the acceptance to be mechanical from the verdict" — when a genuinely independent review comes
back clean, the mechanism should record `review:accepted` and let the drain land it, no human step, for at
least the routine `review:pending` tier. This directly undercuts this epic's own "Done when" #1 (a full fix →
review → land cycle with zero interactive turns) as long as EVERY accept, however clean, still needs a person —
landing it is squarely in scope for `#3383`.

## A fourth verdict already exists and this decision must place it correctly

The enum `VERDICTS`, in `we:scripts/lib/jury-core.mjs` (#2823, already shipped), has FOUR members, not two:
`accept` / `changes` / `needs-human` / `prevention-outstanding`. The last is for exactly the case the operator
named next in this same conversation ("the other status, outstanding improvement or similar"): every actual
finding is already fixed, but a finding's own "Prevention (OWED — file it)" note — the deterministic guard a
juror suggested to stop the same class of bug recurring — was never filed as its own backlog item. Verified in
the real flow tonight's dispatches actually run (`we:scripts/operations/review-loop-cli.mjs` →
`we:scripts/operations/review-pr.mjs` → `reviewLoopAutoConfirm`, not the function `deriveNegotiationOutcome`,
in `we:scripts/lib/jury-core.mjs`, which is a DIFFERENT consumer of the same enum and treats
`prevention-outstanding` differently — do not conflate the two paths): `reviewLoopAutoConfirm` currently folds
`prevention-outstanding` into "everything else, answer `changes`" — an unfixed prevention gate gets BOUNCED and
retried, exactly like a real unfixed bug, even though nothing about the CODE is actually wrong. Every real
bounce tonight (`#1765` rounds 1–2, `#1764` rounds 1–3) carried at least one "Prevention (OWED — file it)" note
that was never filed as its own backlog item — this is not a hypothetical gap, it is the exact thing that
happened, repeatedly, in tonight's own real reviews.

**Ratified, second part of this decision:** `prevention-outstanding` gets its OWN treatment, distinct from both
`accept` and `changes` — file the named prevention(s) as real backlog item(s) (or the learnings pool, mirroring
the function `buildAcceptQueueEntry`'s existing file-then-notify shape), THEN treat the PR as accept-worthy and
clear it mechanically, same as a clean `accept` — never re-enter the bounce/retry loop over a documentation
debt the code itself doesn't have.

## The ratified direction and the one still-open fork

**Ratified:** a clean, genuinely independent verdict on a `review:pending` PR clears mechanically — the
never-auto-accept rule is REMOVED for that case, not merely relaxed by a confidence heuristic (contrast
`#3421`'s own build-dispatch gate, which stays a confidence-scored self-clear/escalate call; this is a flatter
rule — a clean verdict from real independence IS the clearance, full stop, for `review:pending`).

**`review:human`'s own tier — CONFIRMED, not extended here.** The operator, 2026-09-01, directly: "yes review
human are for human." `review:human` keeps its human-only ceremony regardless of verdict — the tier exists
specifically for gate-self / trust-chain-adjacent diffs, where the review process's own independence is the
thing most in question, so folding it into the same mechanical clearance as `review:pending` would erase the
distinction the two tiers exist to draw. This decision's mechanical-acceptance change applies to `review:pending`
only; `review:human`'s existing never-clear-except-by-`--to=clear-human` behavior is UNCHANGED by this card.

## The direct conflict this creates

`#3433` ("technically enforce review-dispatch's never-self-accept/never-merge rule," open, filed, deliberately
deferred) is the exact opposite direction of this decision — it exists to HARDEN the rule this decision REMOVES
for `review:pending`. Once this decision is ratified and shipped, `#3433` needs to be explicitly re-scoped
(narrowed to cover only `review:human`'s own never-clear invariant, if anything is left to harden there) or
closed as superseded — never left standing unchanged, silently contradicting the new doctrine.

## Done when

1. **Executable** — the function `reviewLoopAutoConfirm`, in `we:scripts/lib/review-loop-policy.mjs`, is
   updated so a genuinely independent `accept` verdict on a `review:pending` PR CAN record `review:accepted`
   unattended (its own docblock's "must never change without a fresh ruling" line updated to point HERE as
   that fresh ruling) — with a real test pinning the new allowed case, and a real test that a `needs-human`
   verdict, and a PR carrying `review:human`, both still decline exactly as before, unchanged.
2. **Executable** — `prevention-outstanding` gets its own branch in the same function: file the named
   prevention(s) (reusing the file-then-notify shape `buildAcceptQueueEntry` already established), then answer
   as accept-worthy rather than falling through to the generic `changes` answer — with a real test proving a
   `prevention-outstanding` verdict no longer bounces once its prevention is filed.
3. `we:skills-src/review/review-agent-brief.md` (the dispatched-reviewer brief) is updated to match — it
   currently instructs "queue it... stop here... do not run that resume command yourself" for what would
   otherwise be an accept; that instruction is now only correct for `review:human`, not for `review:pending`.
4. `#3433` is re-scoped (narrowed to `review:human` only, if anything is left to harden there) or closed as
   superseded by this decision — never left standing unreconciled, contradicting the new doctrine.
