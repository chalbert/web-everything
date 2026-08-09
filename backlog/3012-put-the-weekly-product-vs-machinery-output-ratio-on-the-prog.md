---
bornAs: xzgt6zd
kind: story
size: 2
status: resolved
dateOpened: "2026-08-08"
dateResolved: "2026-08-09"
graduatedTo: "we:scripts/lib/output-mix.mjs"
relatedTo: ["2606", "1855", "3010"]
tags: [progress-board, metrics, throughput, governance]
---

# Put the weekly product-vs-machinery output ratio on the progress board

Add one standing number to the progress board: lines added this week to product code versus lines added to
delivery machinery and backlog bookkeeping, with the last four weeks beside it. The 2026-08-08 delivery
review measured the slide at product +1,699 → +705 → +480 → +147 lines/week while machinery grew to
+38,000/week — a month-long trend nothing on the board surfaced. This metric makes the drift visible the
week it starts, so it costs one glance instead of an audit.

## The measurement

Derivable from git alone, so the board generator can compute it mechanically:

- **Product** = lines added under `we:src/`, `we:blocks/`, `we:demos/`, `we:tests/`.
- **Machinery + bookkeeping** = lines added under `we:scripts/`, `we:tools/`, `we:.claude/`,
  `we:docs/agent/`, plus `we:backlog/`.
- A small "other" remainder is excluded from both.

Render the current week's two numbers and a four-week mini-trend on the board (the generator the
progress-board item 3022 builds, in flight as PR #1101). No new data store — `git log --numstat` over
the merged history is the source.

## What was built, and what the number actually is

The classifier is `we:scripts/lib/output-mix-paths.json` — an ordered, first-match-wins path-pattern list
where every rule carries a one-line `why`, so disagreeing with the number means editing one rule, never
patching a script. The derivation is `we:scripts/lib/output-mix.mjs`; the board renders it as its *Output
mix* section. Weeks are ISO weeks (Monday 00:00 **UTC**), and commit days are read on the same UTC clock, so
the four completed weeks have frozen boundaries and re-run identically for anyone on the same commits.

Extensions beyond the list above, each because it is the same machinery under a different name:
`we:skills-src/` (`.claude/skills` is a symlink to it), `we:agent-memory-src/`, `we:.github/`,
`we:.githooks/`. Stated treatments: test lines count **with the thing they test** (`scripts/__tests__/` is
machinery, `tests/` is product); generated files, lockfiles and vendored code are **`other`**, never product
or machinery, since nobody authored those lines; `we:reports/` is `other` by an explicit rule rather than by
omission. The `other` remainder is **rendered**, so a reader can see how much of the tree the two headline
numbers do not cover.

**Measured 2026-08-09** (product → machinery, added lines/week):

| Week from | Product | Machinery | Other |
| --- | --- | --- | --- |
| 2026-07-06 | +1,106 | +28,757 | +4,041 |
| 2026-07-13 | +1,883 | +12,638 | +2,024 |
| 2026-07-20 | +206 | +26,553 | +989 |
| 2026-07-27 | +627 | +36,347 | +757 |
| 2026-08-03 (partial) | **+0** | **+47,014** | +1,014 |

**The quoted `+1,699 → +705 → +480 → +147` did NOT reproduce, and is recorded here as unreplicated.** No
`2026-08-08 delivery review` exists under `we:reports/`; the figure appears only in this card and in #3010,
with no derivation behind it. Re-derivation was attempted across the natural variants — ISO weeks and
rolling 7-day windows, author date and committer date, all-commits and `--first-parent`, anchored at
2026-08-07/08/09 — and none produced the quartet. The classifier was deliberately **not** tuned toward it.
What *does* reproduce is the review's claim: product output has collapsed (roughly +1,100–1,900/week a month
ago to **zero** so far this week) while machinery climbed past +47,000/week, above the quoted +38,000.

Product in this repo is **real but small**, not empty: `we:src/` (the spec data plus the 11ty site that
renders it), `we:blocks/`, `we:demos/`, `we:tests/`. Per constellation rule 1 WE holds zero standard
*implementation*, so the product surface here is definitions and the site over them — which is why it can
credibly sit at +0 for a week while the machinery does not.

## Why on the board and not a report

The board is the one surface the operator already reads daily. #2606 (the throughput program) tracks
latency; this is the missing *output-mix* axis. It is also the enforcement instrument for the process-work
freeze / product-quota decision (#3010): a quota nobody can see is a quota nobody keeps.
