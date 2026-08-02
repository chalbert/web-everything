---
kind: story
size: 3
parent: "2527"
status: open
dateOpened: "2026-08-02"
tags: [drain, review, gate, durability, root-cause, tech-debt]
---

# Drain durable-record state must be attested by the verified effect, not by intent

Every place the drain sets in-memory state to mean a durable external record exists must key that state off the write actually landing (the verification the code already performs), never off having computed or attempted it.

## The root cause this addresses

This is filed as the **root-cause** item behind a four-round review of the #2820 PR, not as a fix for any one of
the defects that review found. The defects were symptoms; this is the shape they share.

The drain writes durable records to GitHub — park comments, skip comments, the #2324 escalation-reason body block.
Those writes are **best-effort**: each is wrapped in a `try`/`catch` that swallows failure, because a transient
`gh` error must never abort a drain pass. The drain then keeps **in-memory flags that mean "a durable record for
this PR exists"**, and later branches suppress other records on the strength of those flags.

The recurring bug is that **the flag is set from the intent to write, not from the write landing.** When the write
silently fails, the flag still says the record exists, the later branch suppresses its own record, and the PR ends
the pass with **no record at all** — the exact opposite of the intent. The failure is invisible: the pass reports
success, the log line about the record was already printed, and only a human opening the PR discovers there is no
explanation of why it was not landed.

## Why this is the root cause and not a one-line fix

The same mistake was made **twice, in the same function, in consecutive review rounds**:

- **Round 3** set the suppression flag on *entry* to the park branch. Two park kinds post nothing of their own
  (a `review:changes` wait-author gets no `applyLabel`; a de-escalated `review:human` park has empty reasons, so
  `buildEscalationReasonBlock([])` returns `''`). Both were suppressed, and both lost their #2313 record.
- **Round 4**, fixing exactly that, introduced a `durableRecorded` flag — and set it from **`reasonBlock` being
  non-empty**, i.e. from having *computed* the body block, not from the body edit succeeding. The very next lines
  already compute a `verified` flag, with a comment reading *"never trust the edit call's exit code alone"*. The
  new flag trusted something weaker than the exit code the surrounding code had already learned not to trust.

A one-line patch at that site would be the third round of the same mistake. What is missing is a **rule** and a
**sweep**: state that asserts a durable record exists is only ever set from a verified effect.

## What to do

1. **Sweep** we:scripts/merge-ai-prs.mjs for every in-memory flag whose meaning is "a durable external record now
   exists" — at minimum `durableRecorded` and `reviewParked`, and audit `collisionHealed` and any label-application
   bookkeeping for the same shape. For each, confirm it is set from the verified effect.
2. **Key each off the verification that already exists** where the code performs one (the #2324 body path already
   computes `verified`; `postDrainReasonComment` already returns a posted/deduped signal). Add a verification only
   where none exists and the record actually matters.
3. **When a durable write cannot be confirmed, do not suppress the fallback record.** Failing toward a duplicate
   comment is strictly better than failing toward silence: a duplicate is noise a human can ignore, silence is a PR
   with no stated reason. Make that the documented default.
4. **State the rule where the next author will read it** — a comment at the flag's declaration, not only in a
   commit message.

## Acceptance

- No flag in we:scripts/merge-ai-prs.mjs that means "a durable record exists" is set from an attempt, a computed
  value, or branch entry — each is set from the write being confirmed.
- Regression per flag: with the external write forced to fail, the PR still ends the pass with **exactly one**
  durable record (the fallback fires) — never zero.
- The known open case is covered: a stale-acceptance `review:human` re-park whose body edit fails still yields a
  record. On `main` today it does; under the #2820 PR's round-4 code it does not, which is the regression that
  motivated this item.
- The rule is written at the point of use, so the next author adding a best-effort write inherits it rather than
  rediscovering it.
