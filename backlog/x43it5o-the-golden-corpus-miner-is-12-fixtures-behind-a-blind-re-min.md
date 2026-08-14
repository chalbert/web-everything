---
kind: task
parent: "2997"
status: open
dateOpened: "2026-08-14"
tags: [guards, golden-corpus, footgun, data-loss]
scope:
  - we:scripts/mine-golden-corpus.mjs
  - we:scripts/golden-corpus/
  - we:scripts/__tests__/golden-corpus-snapshot.test.mjs
---

# The golden-corpus miner is 12 fixtures behind; a blind re-mine deletes them

Found while building [#2997], which had to re-mine two `hook-guard-*` categories. **The miner regenerates
fewer fixtures than the corpus currently holds**, so running it and committing the result silently drops
the difference — including the `reexec-*` and `subshell-closer-*` fixtures.

The [#2997] build noticed, restored them by hand, and spliced only its own categories' counts
(`hook-guard-bash` 28→34, `hook-guard-lane` 4→7). **The drift is still there.** The next person who re-mines
without checking loses those 12, and each one is a guard behaviour that stops being pinned.

## Why this is worse than an ordinary stale fixture

A deleted golden fixture is a **deleted guarantee**, and it deletes silently: the suite goes green, because
the assertion that would have failed no longer exists. That is the same shape as the decorative tests this
repo keeps finding, except it arrives by tooling rather than by authoring — nobody has to write a bad test,
they only have to run a script.

## Confirmed, one category

An independent reviewer of [#2997] (PR #1234, 2026-08-14) re-mined at `origin/main` as part of verifying the
corpus wasn't dropped by that PR: `hook-guard-bash` miner output is **16** against a committed index of
**28** — the same 12-file gap, pre-existing, not introduced by #2997. One category only; the other
categories in the corpus were not re-mined by that check.

## What is not yet established

- **Why** the miner is behind — whether those 12 were added by hand, whether a generator changed, or
  whether the miner's category list no longer covers them. **Diagnose before fixing**; a fix that
  regenerates them without knowing why they went missing can lose them again the same way.
- Whether categories other than `hook-guard-bash`/`hook-guard-lane` are also behind. 12 is what two builds
  happened to notice on two categories, not a measured total across the corpus. **Count the real drift
  across every category first** — that number decides whether this is a task or a story.

## Done when

- [ ] The real drift is measured across all categories, and the number is on this card.
- [ ] Re-mining is safe: it either reproduces the full corpus, or it REFUSES and names what it cannot
      regenerate rather than dropping it.
- [ ] A test fails if a re-mine would delete a fixture — the property that was missing, not just the
      current 12 restored.

## Watch for

- Do not "fix" this by regenerating and committing whatever comes out. That is the failure mode, performed
  deliberately.
