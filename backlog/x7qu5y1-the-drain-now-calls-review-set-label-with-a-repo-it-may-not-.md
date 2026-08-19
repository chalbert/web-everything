---
kind: task
status: open
priority: high
dateOpened: "2026-08-19"
tags: []
---

# the drain calls review-set-label with a --repo it may not be standing in

`we:scripts/review-set-label.mjs` computes its reviewed-diff fingerprint with NO explicit cwd, and its own comment names the condition that breaks it: if the CLI grows a --repo that can name a repo other than the cwd's, the call must take a cwd or it fingerprints the wrong tree. The #x5e2ldj re-stamp met it, and `restamp` IS inside the gate computing the fingerprint — so this is LIVE, not a future trap. `restampAcceptance` in `we:scripts/merge-ai-prs.mjs` spawns the CLI with no cwd while the drain sweeps three repos at once, so a sibling-repo PR is fingerprinted against whatever tree the drain stands in.

## What actually fires, and when

The drain's rebase-drop loop already computes `cloneDir` for a sibling repo (it pins every git read it makes
itself to that directory — omitting it there was a real defect once). `restampAcceptance` does not pass it:
its `spawnSync` carries `{ encoding: 'utf8' }` and nothing else, and the drain never `chdir`s. So the child
runs in the drain's own cwd, which for a `plateau-app` or `frontierui` PR is not that PR's repo.

Inside the CLI, `restamp` is in BOTH gates — the one that computes `reviewedDiff`, and `stampsAcceptance` in
the comment builder that renders `reviewed-diff`/`reviewed-contribution` into the durable comment. It reaches
`computeNetDiffText` with `rev: headRefName` and a fetch of that same ref.

Two outcomes, and only one of them is safe:

- **The ref is not resolvable in the wrong tree.** The read throws, the block's `catch` leaves `reviewedDiff`
  empty, no marker is stamped, and the staleness gate falls back to SHA identity — the STRICTER path. This is
  the common case and it is why the defect has not been seen yet.
- **A branch of the same name exists in the wrong tree.** It resolves, and a fingerprint of an unrelated
  repo's diff is stamped as this PR's `reviewed-diff`. That is not a loud failure: a wrong fingerprint never
  matches, so the PR re-parks on every subsequent pass — the exact loop #x5e2ldj was built to end, now
  reachable through the fix for it.

The second case is not hypothetical. Lane branches are named `lane/<NNN>-<slug>` across the constellation
from one shared convention, and `we:scripts/merge-ai-prs.mjs` elsewhere warns in its own comments that
cross-repo collisions on that name are real enough to need healing.

## Two ways to close it

- **Thread the `cwd` through.** `restampAcceptance` is called with `cloneDir` in scope; pass it into
  `spawnSync`. One option, and it makes the CLI's stated invariant hold for this caller by construction.
- **Refuse instead.** Have the fingerprint block refuse when `--repo` names a repo that is not the cwd's, so
  the wrong-tree case is impossible rather than merely avoided. Stricter, and it converts a silent wrong
  answer into a loud one.

They are complements, not alternatives: the first fixes today's caller, the second protects the next one.

## How the first version of this card got it wrong

Worth recording, because the failure is cheap to repeat. This card originally argued the risk was dormant —
that `restamp` had never been added to the `accepted || clear-human` list, so no fingerprint was computed. It
had been, in the same commit that introduced the target. The claim came from an earlier reading of the file
and was carried forward into the card without being re-checked against what landed. The `review-pr`
correctness juror caught it on PR #1484 by reading the source instead of the card. A claim of the form 'X is
not wired up yet' is the one most worth re-grepping immediately before it is written down.

## Done when

1. **Executable** — a test that drives the re-stamp for a repo other than the process cwd's and asserts the
   fingerprint is computed against that repo's clone (or that the call refuses). It must fail before the fix:
   assert the `cwd` that reaches the git read, not merely that the command was spawned.
2. The comment in `we:scripts/review-set-label.mjs` that states the invariant names the callers that now pass
   `--repo`, so the next reader is not told the CLI is still single-PR and operator-invoked.
3. The single-PR operator path is unchanged — the ordinary `--to=accepted` run must not start requiring a flag
   it never needed.
