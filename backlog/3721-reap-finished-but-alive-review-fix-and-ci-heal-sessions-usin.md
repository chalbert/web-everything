---
bornAs: x9rppp9
kind: story
size: 3
parent: "3718"
status: open
relatedTo: ["3435", "3469", "3624", "3655", "3720"]
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/__tests__/session-reaper.test.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Reap finished-but-alive review, fix and ci-heal sessions using the completion record as ground truth

About 30 finished review sessions sat idle but alive on 2026-09-19. Reconcile read each as a live process working its PR and refused nearly every PR as `live-process`, which silently froze the fix pipeline. This is the highest-value mechanisation in the umbrella, and it is smaller than it looks: the reaper already exists.

## What exists, and the exact gap

`we:scripts/conveyor/session-reaper.mjs` (#3435, #3469) is wired into the runner as pass §4d and reaps a background session on two axes only: its own `state` is `done` or `failed`, or its target (derived from the session name, `review-<PR>` and friends) is independently confirmed finished (a resolved item, or a merged PR via one bounded `gh pr view`). A review session whose review is finished but whose PR is **still open** matches neither axis. The reaper's own header records this shape: `review-1871`, an open unmerged PR, was correctly left alone because nothing could tell it was finished.

Two more facts make it worse today:

- The runner is not running, so §4d never runs. The reaper is a standalone CLI, so nothing stops a session or a hook calling it, but nobody does.
- Related but different: #3624 covers a session that never started, and #3655 covers long-idle peer sessions. Neither covers a session that DID finish its work.

## The signal that is already there

Dispatched agents report through `we:scripts/operations/completion-cli.mjs`: `report --status=started` as their first action, then the same record updated to `status: done` at whichever exit they actually take (`we:scripts/operations/completion-record.mjs`, stored by `we:scripts/operations/completion-store.mjs`). That record is keyed by the dispatcher-minted session slug, the same slug the reaper already parses. A session whose completion record says `done` and which `claude agents` still lists alive has, by the agent's own final report, nothing more to do.

## Proposed fix

Add the completion record as a third ground-truth axis in `classifySessionReapWithGroundTruth`, beside the existing state axis and target axis. Same rules as the existing axes: never on a guess, an unreadable or missing record leaves the session `not-terminal`, `kind !== 'background'` stays the absolute first guard, and the existing per-pass `gh` cap and caching are untouched (this axis is one local file read). Do NOT widen it to a time-based idle timeout; the completion record is a fact, an idle clock is a guess.

As the first step of the slice, confirm that review and fix agents report `done` on every exit path (the record is written "at whichever exit they actually take"). If a path is found that exits without reporting, fix the brief (`we:skills-src/review/review-agent-brief.md`, `we:skills-src/conveyor/fix-agent-brief.md`) in the same slice or file it and say so here.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/session-reaper.test.mjs` carries cases that fail before and pass after: a `review-<PR>` session with a `done` completion record, an OPEN target PR and a live `working` or `blocked` state is reaped; the same session with a `started` record is kept; a missing or unreadable record is kept; a `kind: interactive` row is never reaped whatever its record says.
2. **Probed live** — `node we:scripts/conveyor/session-reaper.mjs --dry-run --json` against the real `claude agents` listing names the finished-but-alive review sessions as reap candidates and none of the genuinely working ones.
3. After a real (non-dry) pass, `node we:scripts/conveyor/reconcile-pass.mjs` no longer reports `live-process` for a PR whose only bound session was a finished reviewer.
