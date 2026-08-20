---
bornAs: xrk6hmj
kind: task
status: open
dateOpened: "2026-08-20"
tags: []
---

# Declare a record-verdict operation to carry a verdict off a credential-less host

No process on a cloud VM holds a GitHub credential, so review-pr's record effect fails and the verdict has to travel as a file pushed to the ops/review-requests transport branch, which CI applies. That transport had no caller: it was hand-assembled from a shell one-liner eight times in one session, each restating the PR number, repo, actor and session id. A wrong number records a verdict on the wrong PR. This declares the transport as an operation whose only subject input is a run id, so every fact is read back out of the run the review wrote.

## The defect is retyping, not tedium

The transport itself already works: a request JSON on `ops/review-requests`, picked up by
`we:.github/workflows/apply-review-request.yml`, applied by `we:scripts/apply-review-request.mjs`
shelling the real `we:scripts/review-set-label.mjs`. Nothing about that needed building.

What had no home was the *caller*. Each delivery was a fresh `JSON.stringify` restating four facts —
PR number, repo, actor, juror session id — beside a body path copied out of a directory listing. That
is the same class #1466 closed on the reading side: a mis-keyed subject silently attaches a review to a
**different PR**, and every artefact downstream still says it is the one you named. The reading side was
made fail-closed; the writing side was still eight hand-typed chances to get it wrong.

So the operation takes **`--runId`, and deliberately no `--pr`**. The subject, the repo, the juror's
session id and the staged write-up are all read back out of the run record the review itself wrote.
There is no flag to mistype onto another PR.

## What it refuses

Every refusal is about publishing something that was never actually reached:

- **no run record** → the verdict is read, never retyped; there is nothing to read;
- **not a `review-pr` run** → no verdict exists on it to record;
- **no verdict on the record** → the judge step never produced one, and a staged request for it would be
  indistinguishable from a real review on the transport branch;
- **no staged write-up** → the durable comment *is* the review; a verdict with an empty body lands a
  label and tells the author nothing;
- **an unusable subject** (`pr` not a positive integer, `repo` not a slug) → refused rather than defaulted.

A missing juror `sessionId` is the one absence that is *not* fatal: without it the durable comment
records independence as UNPROVEN, which is the truth. Inventing one would be worse than lacking it.

## It states no rule of its own

The request's legality is `we:scripts/apply-review-request.mjs`'s `validateRequest`, and the legal
targets are its `APPLIABLE_TARGETS` — both **imported and injected**, never restated. That is the
single-home discipline of #2644, and it is here for a specific reason: the `verify` operation built
immediately before this one *did* restate a decision that already had a home, and shipped a second
answer to "is this lane verified" that could disagree with the first. Its own header forbade exactly
that and it happened anyway. This one imports the applier's validator so the two cannot drift; the tests
assert the enum is taken from the applier rather than typed out.

The reduced panel verdict is **reported, not enforced**. An operator recording `changes` over a panel
that reduced to `accept` is a legitimate override — #2409's arc has always allowed it — so it is
surfaced as `disagreesWithPanel` rather than blocked, and the record shows the override happened
instead of hiding it.

## The push is a worktree, never a branch switch

`ops/review-requests` is a transport branch and the caller is standing in a lane holding their own
uncommitted work. Checking the transport branch out over that lane takes the work with it — done by
hand earlier in this session, it disrupted a juror mid-review. So the sink writes through a dedicated
`git worktree` and removes it in a `finally`, whether the push succeeded or not: a stranded worktree
makes the next `worktree add` on the same branch fail, turning one bad run into every subsequent one
failing.

"Nothing to commit" is treated as **success**, not error. An identical request already staged is the
`idempotent: true` promise being kept on replay — the transport applies what a push *added*, so an
identical overwrite is one delivery, not two.

## Done when

1. **Executable** — `npx vitest run` over `we:scripts/operations/__tests__/record-verdict.test.mjs` passes 21
   assertions that fail before this item lands (the module does not exist).
2. **Derived, not hand-written** — `record-verdict --help` through `we:scripts/operations/run.mjs` prints a usage
   line with `--runId` required and no `--pr` at all, derived by the CLI adapter from the declaration.
3. **Wired where the step is described** — the skills that tell an agent to record a verdict name the
   operation rather than a hand-rolled request.
