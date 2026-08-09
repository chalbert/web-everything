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

**Measured 2026-08-09 at `cf6730a3`** (product → machinery, added lines/week), by the rule list AS FIRST
COMMITTED — before the `we:docs/**` and `we:.lane-manifest.json` rules added in review, so the machinery
column below understates by +1,144 (2026-07-06), +1,033 (2026-07-13) and +26 (2026-07-27):

| Week from | Product | Machinery | Other |
| --- | --- | --- | --- |
| 2026-07-06 | +1,106 | +28,757 | +4,041 |
| 2026-07-13 | +1,883 | +12,638 | +2,024 |
| 2026-07-20 | +206 | +26,553 | +989 |
| 2026-07-27 | +627 | +36,347 | +757 |
| 2026-08-03 (partial) | **+0** | **+47,023** | +1,014 |

The four completed rows re-derive exactly under an independent pipeline (human-readable `--numstat`, own
rename parse, own transcription of the rules). The partial row is the one that moves: it was published as
`+47,014`, 9 lines short of what the committed script yields at the stated SHA, and it grows with every
commit — at `72b93534` the same script reads `+47,902`. Read the completed weeks, not the partial one.

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

## The product number is a LOWER BOUND — an operator call is open

Review finding, recorded rather than silently fixed. The rule list is an allowlist over a default of
`other`, and the two headline classes are **not covered equally**. Machinery lives in nine stable
directories, every one of them matched, so machinery coverage is effectively complete. Product is matched in
**four** — while the standard's own declarations live in **52 further top-level directories** that no rule
names: `we:contracts/`, `we:capabilities/`, `we:conformance-vectors/`, `we:webcases/`,
`we:validation-generation/`, `we:capability-manifest/`, and the per-domain contract trees (`we:intl/`,
`we:webtheme/`, `we:permissions/`, `we:positioning/`, `we:realtime/`, …). Those fall to `other`:
**38,852 tracked lines** at the 2026-08-09 HEAD, and ~730 of the added lines across the five measured weeks.

So the published `product` figure is a **lower bound** and the machinery:product ratio an **upper bound**,
and the bias runs in the same direction as the conclusion the number is being used to support. Counting the
plausibly-product remainder as product gives **+1,591 → +1,909 → +427 → +627 → +0** against the published
+1,106 → +1,883 → +206 → +627 → +0. The headline finding survives either way — the ratio stays above 20×
every week and the current week stays at zero — but the exact product figure should not be quoted as final
until the directories above are ruled.

Deliberately NOT decided here, because it moves the headline number: whether those 52 directories are
`product`. `rule-list coverage over the real tree` in `we:scripts/lib/__tests__/output-mix.test.mjs` pins
the list, so a new uncovered directory fails loudly and the ruling must shrink the list in the same diff.
Also left to the operator: whether `we:reports/` is `other` (as committed) or machinery — reports are
written by the delivery loop about the delivery loop, and moving them adds ~+1,000/week to machinery.

## Why on the board and not a report

The board is the one surface the operator already reads daily. #2606 (the throughput program) tracks
latency; this is the missing *output-mix* axis. It is also the enforcement instrument for the process-work
freeze / product-quota decision (#3010): a quota nobody can see is a quota nobody keeps.
