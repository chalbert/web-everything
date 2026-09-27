---
bornAs: xyu6qhc
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/lib/automation-home.mjs", "we:scripts/conveyor/queue-store.mjs", "we:scripts/conveyor/queue.mjs", "we:scripts/lib/gh-app-shim.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Decouple the automation from the operator's primary checkout: control clone + state home

The automation reads code and state from the operator's own working copy (a detached HEAD 449 commits behind main on 2026-09-27): the build queue sidecar, dispatch-lane invocations, and the gh shim's throttle CLI. Move code to a daemon-owned control clone and state to the existing out-of-tree state home (we:scripts/lib/automation-home.mjs).

## Design note

**Problem.** The primary checkout is the operator's personal working copy (dev server, WIP). It is often a
detached HEAD far behind `main`. The automation still depended on it:

- the build queue lived in its `we:.conveyor/queue.json`, and the build-dispatch daemon was pinned there
  (`CONVEYOR_STATE_ROOT=<primary>`, we:skills-src/conveyor/launchd/com.we.build-dispatch-daemon.plist.example);
- `we:scripts/operations/run.mjs dispatch-lane` refuses lane checkouts, so it ran from the primary, on 449-commit-old code (#3604
  ran on Claude instead of Codex);
- the gh shim baked the primary's `we:scripts/lib/gh-throttle.mjs` (we:scripts/lib/gh-app-shim.mjs#defaultGhThrottleCliPath).

**Target.** Nothing in the automation reads code or state from the operator's checkout. Two homes, one
resolver (we:scripts/lib/automation-home.mjs):

- **State home** = the existing out-of-tree root the run scorecards and health watch already use
  (`~/.claude/daemon-self-sync-state/conveyor-state`, we:scripts/lib/daemon-last-good.mjs#daemonConveyorStateRoot).
  Reused, not a second new root.
- **Control clone** = `<workspace>/wev-control` (`WE_CONTROL_CLONE` overrides). The build-dispatch daemon runs
  FROM it with `--self-sync`, so the existing rebuild machinery (we:scripts/lib/daemon-rebuild.mjs, smoke gate,
  last-good hold) keeps it on `origin/main`. The operator creates it once (a `git clone` + `npm ci`, like every
  other daemon clone); nothing creates clones automatically today, and this does not add that.

**Compatibility (one release).** A read of the queue's new default path with no file there falls back to the
workspace primary's old `we:.conveyor/queue.json` (read-only; never a lane's own stale sidecar). The first
read-modify-write, or `we:scripts/conveyor/queue.mjs migrate`, lands it in the state home. `we:scripts/conveyor/queue.mjs list` flags a legacy file
written after the move (an old-code writer). The shim falls back to the primary only while the control clone
is not provisioned.

**Slices.**

1. *(this PR)* state home for the queue + migration + compat read; queue writers (we:scripts/conveyor/queue-work.mjs,
   we:scripts/operations/file-item-io.mjs, we:scripts/operations/land-advance-items-io.mjs) target it; shim throttle
   path prefers the control clone; plist example runs from the control clone with the state-home pin.
2. dispatch-lane from the control clone: orchestrator docs + `we:scripts/operations/run.mjs` preflight accept it by name (builds on
   PR #2815's stale-dispatcher refusal); a health smell for a shim or plist that still names the primary.
3. the other per-checkout state: `we:.conveyor/dispatch-pause.json` and `we:.conveyor/land-advance-opt-in.json`
   (we:scripts/operations/land-advance-gate.mjs#canonicalRoot still reads them from the runner/primary),
   `we:.operations/runs` and `we:.operations/review-jobs` records (per-checkout unless `OPERATION_RUNS_DIR` is set).
4. drop the compat reads after one release.

Out of scope, noted: lanes are cloned with `--reference <primary>` (we:scripts/bootstrap-session.mjs), so lane
object stores still borrow the primary's `.git`. Read-only, but a dependency; worth its own card.

## Done when

1. **Executable** — `npx vitest run --config we:vitest.soak.config.ts we:scripts/conveyor/soak/breaks/queue-split-across-checkouts.soak.test.mjs`
   passes (it fails on the pre-change tree: the daemon's clone read `[]` after the operator cleared work).
2. `node we:scripts/conveyor/queue.mjs migrate --dry-run` from any checkout reports the primary's entries moving
   to the state home; the build-dispatch daemon's `--dry-run` reads them with no `CONVEYOR_STATE_ROOT` set.
