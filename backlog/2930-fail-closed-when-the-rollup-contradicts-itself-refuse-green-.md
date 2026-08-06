---
bornAs: x4njmrs
kind: task
status: open
dateOpened: "2026-08-05"
tags: [drain, ci, gate, security]
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
---

# Fail closed when the rollup contradicts itself: refuse green if a later-started matching CheckRun is definitively red

`latestRequiredCheck` trusts GitHub's creation order without ranking. A veto — never a re-rank — hedges that
unpinned bet: if any matching CheckRun is red with a strictly later `startedAt`, the check is not green.

## Why it is owed

`#2932` deliberately chose "the LAST matching entry is the newest" and deleted the timestamp ranking that
preceded it. That ranking bought three defects and no observed benefit, so the deletion was right — but it
leaves one assumption unpinned: **GitHub returns `statusCheckRollup` in creation order.** Nothing in the API
contract guarantees it, and nothing in the repo would notice if it changed. If it ever does, the drain reads a
stale entry as current and can land on a superseded verdict.

The fix is not to re-introduce ranking. It is a **veto**, which sidesteps both prior rejections because it never
decides *which* entry is newest — it only refuses to say green when the evidence contradicts itself:

> `isRequiredCheckGreen` returns `false` if, alongside the selected green entry, another CheckRun matching the
> same name is definitively red (`FAILURE`/`ERROR`/`CANCELLED`/`TIMED_OUT`/`ACTION_REQUIRED`/`STARTUP_FAILURE`)
> and carries a **strictly later** `startedAt`.

Because it is one-directional, none of the ranking defects can recur: a missing or unparseable stamp yields no
comparison and therefore no veto (it degrades to today's behaviour, never to a false green); only `startedAt` is
ever compared to `startedAt`, so the mixed-clock bug has nothing to bite on; and the
`0001-01-01T00:00:00Z` sentinel can only ever fail to trigger a veto, never cause one.

Raised as correctness-lens finding 2 on PR #1049 and explicitly ruled **non-blocking** for that PR — it hedges
an unpinned ordering bet rather than fixing a regression. Filed here so the hedge is not lost.

## Build

- In `we:scripts/merge-ai-prs.mjs`, add the contradiction veto to `isRequiredCheckGreen` (and only there —
  `isRequiredCheckFailed` already fails closed by construction). Keep `latestRequiredCheck` itself untouched: it
  stays a pure selector with no clock.
- Compare `startedAt` to `startedAt` only, on `CheckRun`-tier rows only (`rollupRowKind` === `'CheckRun'`), and
  require a strict `>`; treat any absent/unparseable/sentinel stamp as "no comparison available" → no veto.
- Emit the contradiction on the drain's park/skip reason so an operator sees *why* a rollup was distrusted
  rather than a silent not-green.

## Acceptance

- A rollup of `[CheckRun test SUCCESS @18:35, CheckRun test FAILURE @18:40]` reads NOT green, in either array
  order.
- A rollup of `[CheckRun test FAILURE @18:34, CheckRun test SUCCESS @18:35]` (the PR #1042 shape) still reads
  GREEN — the veto must not undo `#2932`.
- Stamp-less, sentinel-stamped and unparseable-stamped rollups behave exactly as they do today.
- A `StatusContext` never vetoes a `CheckRun` (it is not in the CheckRun tier).
