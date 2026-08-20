---
bornAs: xalrjkh
kind: task
status: open
dateOpened: "2026-08-20"
tags: []
---

# Extract the applier subject predicate so record-verdict stops copying its regex

A correctness juror on PR 1497 confirmed that factsFromRun re-derives the appliers repo-slug regex and positive-integer PR check instead of importing them, which contradicts that files own header claim that it states no request rule of its own. The to enum IS imported and pinned by a test one paragraph away, so the discipline was understood and applied unevenly. If the applier widens the slug charset, the stale copy silently refuses runs the applier would accept.



## The finding, as the juror stated it

Confirmed by the `correctness` juror on PR #1497 (`disposition: carve-out`, `impactIfUnfixed: degraded`,
so it did not block the accept — but `preventionCaptured: false`, which is why this card exists).

`we:scripts/apply-review-request.mjs`'s `validateRequest` owns the subject rule: a `/^[\w.-]+\/[\w.-]+$/`
slug for `repo` and `Number.isInteger(pr) && pr > 0`. `we:scripts/operations/record-verdict.mjs`'s
`factsFromRun` independently re-derives the identical rule rather than importing a shared predicate.

**What makes it worth fixing rather than shrugging at** is that the same file gets this right one
paragraph away: the `to` enum IS imported (`APPLIABLE_TARGETS`) and pinned by a dedicated test, *"takes
its target enum from the APPLIER, so the two cannot disagree about what is legal"*. The discipline was
understood and applied unevenly, and the file's header claims it was applied uniformly — *"it states no
request rule of its own"*. That claim is currently false.

## Why the author did it, per the juror's root cause

`factsFromRun` must refuse an unusable-subject run **before** a full request object exists to hand to
`validateRequest` — there is no `to`/`actor`/`body` yet at that point. Copying the regex was the fastest
tool to hand; extracting a small shared predicate was the right one.

## What drifts, concretely

If the applier's subject rule widens — a new GitHub owner-name format, a longer slug charset — a
maintainer edits the applier, the file that actually owns the rule. The operation's
stale copy then refuses runs the applier would legally accept, with a confusing *"names no usable
subject"* error, and the request never reaches the applier's own updated check.

The existing test (`refuses a record whose subject is unusable`) exercises the copy against hard-coded
examples. It would catch deleting the check; it would **not** catch the two rules drifting apart, which
is the failure mode. The juror looked for a provenance test analogous to the enum one and found none.

## Done when

`we:scripts/apply-review-request.mjs` exports a subject-shape predicate (the juror suggests
`isUsableSubject({pr, repo})`), `we:scripts/operations/record-verdict.mjs` imports and calls it rather than re-deriving, and a
test mirrors the existing enum-provenance test by pinning that `factsFromRun`'s subject check IS the
applier's predicate rather than a parallel copy. Changing the applier's rule and not the operation must
redden that test.
