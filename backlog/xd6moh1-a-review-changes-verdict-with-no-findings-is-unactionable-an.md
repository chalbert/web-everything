---
kind: story
size: 1
status: resolved
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-12"
dateOpened: "2026-08-12"
dateStarted: "2026-08-12"
dateResolved: "2026-08-12"
tags: [review, gate, footgun, loop, mechanisation]
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
---

# A review:changes verdict with no findings is unactionable, and the tool allows it

`we:scripts/review-set-label.mjs --to=changes` treats the findings body as OPTIONAL, so a bounce can land as a
bare `🔁 review — changes requested / Recorded by <actor>.` with nothing else. The author is told to fix
something and not told what. The drain then parks the PR behind a hold nobody can clear, because clearing it
means addressing findings that were never written down. Observed live on PR #1178, twice in one afternoon: two
reviewers set the label and neither body reached the comment.

## Why the asymmetry is right

An ACCEPT with no body is merely terse — the label carries the whole meaning, which is "nothing to do". A
BOUNCE with no body carries none of its meaning: the label says *do something* and the something is missing.
So the requirement belongs on `changes` alone, not on every target.

This is the same shape as `--to=clear-human`, which already refuses without `--reason`: the tool makes the
dishonest or useless path take an explicit act rather than a silence.

## Watch for

- The findings body reaches the comment through `--body`/`--body-file`; a reviewer that dies after the label
  write but before the comment write is a DIFFERENT failure and this does not fix it. What it does fix is the
  case where no body was ever supplied.
- Whitespace-only is the same as empty. So is a body that is only the heading the tool already writes.

## Done when

- [x] `--to=changes` with no findings body is REFUSED, naming what to supply.
- [x] `--to=accepted` is unchanged — a terse accept still lands.
- [x] The refusal fires on whitespace-only, not just on absent.

## How it resolved

The findings text is handed to `runReviewLabelCli` as `verdictBody`, alongside the `buildComment` closure that
already renders it. That puts the refusal with the other pre-flight checks — before any `gh` call, reachable
from the in-process harness — instead of in a CLI shell no importer runs.

`rearm` is untouched: it is the conveyor's hand-back to the fix agent, not a reviewer verdict, and carries no
findings by design.

The operation path was already correct — `we:scripts/operations/review-pr-io.mjs` always passes
`--body-file`, and an empty file was already refused. What this closes is the HAND-RUN path, which is where
#1178's two empty bounces came from.

Three mutations reddened named tests: removing the guard, weakening it to presence-only (so whitespace passes),
and widening it to every target (18 red — the asymmetry is load-bearing).
