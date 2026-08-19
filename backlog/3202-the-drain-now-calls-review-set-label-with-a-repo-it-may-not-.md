---
bornAs: x7qu5y1
kind: task
status: resolved
dateOpened: "2026-08-19"
dateResolved: "2026-08-19"
tags: []
---

# the drain now calls review-set-label with a --repo it may not be standing in

`we:scripts/review-set-label.mjs` computes its reviewed-diff fingerprint from a git read with NO explicit cwd, and its own comment names the condition that breaks it: a caller passing a --repo that can name a repo other than the cwd's. The #3200 re-stamp became that caller, and `restamp` IS inside the gate computing the fingerprint — so this was LIVE, not a future trap. `restampAcceptance` in `we:scripts/merge-ai-prs.mjs` spawned the CLI with no cwd while the drain sweeps three repos at once, so a sibling-repo PR was fingerprinted against whatever tree the drain stood in.

## What actually fired, and when

The drain's rebase-drop loop already computes `cloneDir` for a sibling repo and pins every git read it makes
itself to that directory. `restampAcceptance` did not pass it: its `spawnSync` carried `{ encoding: 'utf8' }`
and nothing else, and the drain never `chdir`s. So the child ran in the drain's own cwd, which for a
`plateau-app` or `frontierui` PR is not that PR's repo.

Inside the CLI, `restamp` is in BOTH gates — the one computing `reviewedDiff`, and `stampsAcceptance` in the
comment builder that renders `reviewed-diff`/`reviewed-contribution` into the durable comment. It reaches
`computeNetDiffText` with `rev: headRefName` and a fetch of that same ref.

Two outcomes, and only one of them is safe:

- **The ref is not resolvable in the wrong tree.** The read throws, the block's `catch` leaves `reviewedDiff`
  empty, no marker is stamped, and the staleness gate falls back to SHA identity — the STRICTER path. This is
  the common case and it is why the defect went unseen.
- **A branch of the same name exists in the wrong tree.** It resolves, and a fingerprint of an unrelated
  repo's diff is stamped as this PR's `reviewed-diff`. That is not a loud failure: a wrong fingerprint never
  matches, so the PR re-parks on every subsequent pass — the exact loop #3200 was built to end, reached
  through the fix for it.

The second case is not hypothetical. Lane branches are named `lane/<NNN>-<slug>` across the constellation from
one shared convention, and the drain's own collision-healing path exists because those names really do collide.

## How it was closed

The child PROCESS is pinned rather than the one git read: `restampAcceptance` now takes the `cloneDir` already
in scope at its call site and passes it as the spawn's `cwd`. Pinning the process covers every git read the
CLI makes, not only the one known about today, and it leaves the operator's single-PR invocation untouched —
`undefined` for a local-repo PR still means "inherit", which was already correct. The CLI is still resolved
from `import.meta.url`, so a pinned child runs THIS checkout's label arc and not a sibling repo's copy of it.

A `cwd` option on that single call would NOT have been enough: the `--body-file` allowlist is rooted at
`process.cwd()` too, so the process's location — not any one read's — is the contract. The re-stamp passes no
`--body-file`, and a test pins that it stays that way.

The invariant comment in `we:scripts/review-set-label.mjs` now names the caller instead of asserting the CLI
is still only operator-invoked, and states the rule for the next one: run from the named repo's checkout, or
pin the child to it.

## What is NOT covered

The tests assert the `cwd` that reaches the spawn. That the drain's rebase loop PASSES `cloneDir` at the call
site is not unit-covered — it sits inside the pass loop, which has no seam that reaches it cheaply. The
argument for it is proximity: `cloneDir` is computed a few lines above, and every other git read in that loop
already takes it.

## How the first version of this card got it wrong

Worth recording, because the failure is cheap to repeat. This card originally argued the risk was dormant —
that `restamp` had never been added to the `accepted || clear-human` list, so no fingerprint was computed. It
had been, in the same commit that introduced the target. The claim came from an earlier reading of the file
and was carried into the card without being re-checked against what landed. The `review-pr` correctness juror
caught it on PR #1484 by reading the source instead of the card, and the card landed before the verdict did.
A claim of the form 'X is not wired up yet' is the one most worth re-grepping before it is written down.

## Done when

1. **Executable** — a test drives the re-stamp for a repo other than the process cwd's and asserts the `cwd`
   reaching the spawn is that repo's clone. Removing the `cwd` reddens it.
2. The comment in `we:scripts/review-set-label.mjs` that states the invariant names the callers that now pass
   `--repo`, so the next reader is not told the CLI is still single-PR and operator-invoked.
3. The single-PR operator path is unchanged — the ordinary `--to=accepted` run does not start requiring a flag
   it never needed.
