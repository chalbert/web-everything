---
bornAs: xtnet3w
kind: task
status: resolved
dateOpened: "2026-09-06"
dateStarted: "2026-09-06"
dateResolved: "2026-09-06"
graduatedTo: none
tags: []
relatedReport: reports/2026-09-06-open-story-staleness-audit.md
---

# Reopen #2756 and re-block its two dependents: the Rust SSR foundation was resolved over work that never landed

The 2026-09-06 open-story audit confirmed #2756 was flipped to resolved on 2026-09-06 naming graduatedTo frontierui:plugs/webdirectives/ssr/rust/, a directory that does not exist: frontierui origin/main has zero .rs files, its SSR subtrees are jvm, net and python only, and no Rust branch exists on the remote. #3502 files the missing gate; this task fixes the live consequence. #2761 and #2764 carry blockedBy #2756, so they now read Tier-A ready with a scope: pointing at frontierui:plugs/webdirectives/ssr/rust/src/renderer.rs under a directory that was never created - two cards dispatchable onto a nonexistent foundation. Reopening is a lifecycle reversal, so the audit reported it rather than applying it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Done when

1. `backlog/2756-*.md` is `status: open` again, with its `graduatedTo` cleared and a dated note on the
   card recording that the 2026-09-06 resolve was reverted because the named path never landed.
2. #2761 and #2764 read as blocked again (their `blockedBy: ["2756"]` edge resolves to an open item),
   so neither is selectable by `check:readiness --select`.
3. The revert cites #3502, which is building the gate that would have refused the original land.

## Evidence

Verified 2026-09-06 against `frontierui` `origin/main` (`b2d7b1e`):

- `plugs/webdirectives/ssr/` contains `jvm`, `net`, `python` — there is no `rust` subtree.
- `git ls-files | grep -c '\.rs$'` returns 0.
- `git ls-remote --heads origin` shows no Rust or #2756 branch — the work is not parked on a lane
  either.

## Why this was not applied by the audit

Un-resolving a card is a lifecycle reversal, not a mechanical correction. The audit's mandate covered
resolving items provably delivered and correcting dead references; reverting another session's resolve
is an operator call, so it is filed here instead.
