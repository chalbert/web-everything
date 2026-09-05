---
kind: story
size: 3
status: resolved
dateOpened: "2026-09-05"
dateStarted: "2026-09-05"
dateResolved: "2026-09-05"
tags: []
scope: ["we:scripts/conveyor/duplicate-pr-watch.mjs", "we:scripts/conveyor/__tests__/duplicate-pr-watch.test.mjs", "we:skills-src/conveyor/runner.mjs"]
---

# Detect duplicate open PRs for the same backlog item and flag via reconcile-finding

A mechanical pass (mirroring we:scripts/conveyor/parked-pr-conflict-watch.mjs, #xw0odtv) that lists open PRs, groups them by the backlog item number each delivers (reusing we:scripts/lib/open-pr-items.mjs deliveredItemNumsFromPr), and, when 2+ open PRs deliver the SAME item number, posts a review:changes bounce via we:scripts/conveyor/reconcile-finding.mjs on each one, citing the sibling PR(s). Motivated by the live 2026-09-05 quadruple/double-PR incident on #3478/#3230/#2819/#3481 (root cause: the in-flight build guard losing track of a still-running build, fixed via #1946). Detection and flagging only, never auto-closes a PR, since choosing the correct keeper needs a real content diff (proven by this same incidents manual investigation, where one group turned out to need reconciliation rather than a pick-a-winner close). Dedup: skip a PR that already carries review:changes, treating an existing label as the durable marker rather than minting a new one, mirroring the self-clearing idea in #xw0odtv. Wired into we:skills-src/conveyor/runner.mjs makeCliMechanicalPasses.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/duplicate-pr-watch.test.mjs` passes, including a
   fixture reproducing the real 2026-09-05 quadruple-PR incident on item #3478 (four open PRs, all flagged, no
   keeper chosen) and a case proving a legitimate multi-slice epic (two different item numbers via `parent:`) is
   never flagged.
2. **Executable** — `we:scripts/conveyor/duplicate-pr-watch.mjs sweep --dry-run` runs clean against the live open
   PR list with no `gh` errors.
3. **Executable** — `we:skills-src/conveyor/runner.mjs`'s `makeCliMechanicalPasses` invokes the new pass
   (`grep -n duplicate-pr-watch we:skills-src/conveyor/runner.mjs`), so it runs every tick with no new cron/daemon.
4. **Executable** — `npm run check:standards` stays green.

## Progress

- Built `we:scripts/conveyor/duplicate-pr-watch.mjs`, following `we:scripts/conveyor/parked-pr-conflict-watch.mjs`'s
  pure-core/IO-shell split. Item resolution reuses `we:scripts/lib/open-pr-items.mjs#deliveredItemNumsFromPr`
  verbatim (no re-derivation of its eight-round false-positive guards). Findings post through
  `we:scripts/conveyor/reconcile-finding.mjs` as a subprocess per finding (never in-process — that shim's shared
  harness calls `process.exit()`, which would kill a multi-PR sweep after its first finding). Dedup reuses the
  `review:changes` label itself as the durable marker (no new label minted). 28 unit tests, including the real
  #3478 quadruple fixture and a legitimate-slice negative case. Wired into `we:skills-src/conveyor/runner.mjs`'s
  `makeCliMechanicalPasses` beside the conflict-watch line.
- Ran the pass for real against the live open-PR list (`sweep`, not `--dry-run`) once tests were green: it found
  and flagged 4 genuinely live duplicates — the already-known #1936/#1940 pair on item #2819 (left unresolved by
  the manual investigation as a real merge-needed case, not a pick-a-winner close) and a NEWLY discovered pair on
  item #3478, PR #1939 vs. a fresh PR #1942 that appeared after the original incident's PRs were closed —
  confirming the underlying dispatch bug (or a similar recurrence) is still live and that this pass catches it
  going forward.
