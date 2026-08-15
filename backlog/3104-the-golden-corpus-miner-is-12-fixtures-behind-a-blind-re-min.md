---
bornAs: x43it5o
kind: task
parent: "2997"
status: resolved
dateOpened: "2026-08-14"
dateStarted: "2026-08-15"
dateResolved: "2026-08-15"
graduatedTo: none
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

## Measured drift (2026-08-15)

Ran the miner (`node we:scripts/mine-golden-corpus.mjs`) with its then-shipped defaults against
`origin/main` and diffed the output counts against the committed `we:scripts/golden-corpus/index.json`.
**Total: 25 fixtures across 3 categories** would have been silently deleted by a blind re-mine-and-commit;
5 other mined categories (`backlog-resolve`, `backlog-created`, `memory`, `hook-locus-prefix`,
`hook-guard-lane`) were not behind.

| category | committed | miner output | gap | root cause |
|---|---|---|---|---|
| `hook-guard-bash` | 34 | 22 | **12** | its spec-derived scenario array in the miner's own source never had the 12 `reexec-*`/`subshell-closer-*` cases added — they exist ONLY as hand-added fixture files (the confirmed drift from the #2997 review, one category, this item's opening premise) |
| `backlog-release` | 12 | 1 | **11** | `--backlog-scan`'s 600-commit default window no longer reaches far enough back — the repo's `backlog/*.md` status-touching history has grown to ~2870 commits, and `release` transitions are rare within the most recent 600 |
| `backlog-claim` | 12 | 10 | **2** | same root cause as `backlog-release`, milder — `claim` is a more common verb so the 600-commit window still finds most, not all |

Two distinct causes, confirmed by fix: adding the 12 scenarios back to
`buildGuardBashFixtures()` reproduces the committed `hook-guard-bash` corpus **byte-for-byte** (34/34,
`diff -rq` clean); widening `--backlog-scan` alone (no code change, `--backlog-scan=2870`) brings
`backlog-release`/`backlog-claim` back to 12/12. Both are fixed below.

## Done when

- [x] The real drift is measured across all categories, and the number is on this card. **25, across 3
      categories** (table above).
- [x] Re-mining is safe: it either reproduces the full corpus, or it REFUSES and names what it cannot
      regenerate rather than dropping it. `we:scripts/mine-golden-corpus.mjs` now computes every
      category's fresh count in memory BEFORE any write, compares it against the existing committed
      `we:scripts/golden-corpus/index.json`, and — unless `--force` — refuses (exit 1, nothing written)
      and prints each shrinking category with its committed/mined/missing counts if any category would
      come out smaller than what's already committed. `BACKLOG_SCAN_CAP` default raised 600→3500 (current
      history is ~2870) so the documented default invocation succeeds cleanly; the refuse-guard is the
      durable backstop for when growth outpaces that again.
- [x] A test fails if a re-mine would delete a fixture — the property that was missing, not just the
      current 12 restored. `findShrinkingCategories()` is exported from the miner and unit-tested in
      `we:scripts/__tests__/golden-corpus-snapshot.test.mjs` against synthetic before/after count maps —
      covers shrink, steady/growth (not flagged), a category the miner drops ENTIRELY (mined=0, the
      severest case), and a brand-new category (nothing to compare against) — so it catches this class of
      regression generally, not just today's 12.

## Watch for

- Do not "fix" this by regenerating and committing whatever comes out. That is the failure mode, performed
  deliberately.
