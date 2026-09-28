---
kind: story
size: 3
priority: high
parent: "4075"
status: open
scope: ["we:scripts/lib/daemon-clone-registry.mjs", "we:scripts/guard-lane.mjs", "we:scripts/guard-bash.mjs", "we:scripts/review-set-label.mjs", "we:scripts/conveyor/health-smells/clone-stale.mjs", "we:scripts/conveyor/health-smells/index.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Write guard must cover the control clone ~/workspace/wev-control like other daemon clones

Evidence (2026-09-28): (a) a worker's file-item wrote a card into wev-control and no guard stopped it; (b) the orchestrator ran we:scripts/review-set-label.mjs with --to=clear-human for PR #2831 and #2854 with cwd in wev-control, and the approval-prevention filer (we:scripts/review-set-label.mjs#fileApprovalPreventionCard) wrote x21soye (staged A) and xx604u2 (untracked) there; (c) the dirty clone made the build daemon's self-sync refuse to rebuild ("rebuild did not move the clone (dirty)"), so the builder ran stale code (without the #2857 unfreeze fix) until a labelled emergency cleanup at ~4:05 PM ET on 2026-09-28. we:scripts/lib/daemon-clone-registry.mjs's DAEMON_CLONE_SEED omits wev-control entirely, so we:scripts/guard-lane.mjs and we:scripts/guard-bash.mjs never recognize it as a daemon/control clone and never block writes into it. Fix: register wev-control with the daemon-clone write guard, make approval/prevention filers (we:scripts/review-set-label.mjs#fileApprovalPreventionCard) refuse to write into any daemon or control clone, and add a health smell (alongside we:scripts/conveyor/health-smells/clone-stale.mjs) for a dirty control clone.

## Risks

- `we:scripts/lib/daemon-clone-registry.mjs`'s `DAEMON_CLONE_SEED` is a hand-maintained list of sibling
  directory NAMES (`wev-review-daemon`, `wev-merge-daemon`, `wev-health-watch`, `wev-host-sampler`,
  `plateau-drain-daemon`, the drain's `.lanes/we-drain-daemon/lane-1`); adding `wev-control` there is
  mechanical, but the harder half is (2) below — the approval-prevention filer refusing to write into ANY
  daemon/control clone regardless of registry membership, since a hand-added clone the registry hasn't caught
  up to must still be refused, not silently accepted.
- Must not regress the seed+derived shape's fail-open behavior (a missing/corrupt overlay-state file degrades
  to seed-only, never throws) — the new health smell must follow the same fail-open convention as
  `we:scripts/conveyor/health-smells/clone-stale.mjs`.
- `wev-control` is a human-operated control clone, not a daemon's dedicated checkout — the fix should register
  it as its own recognized kind (or reuse the existing daemon-clone kind if the guard's semantics are
  identical) rather than conflating "control clone" with "daemon clone" in naming, since the two have
  different owners even though both need the same write protection.

## Test plan (each fails before the change, passes after)

1. A unit test on `we:scripts/lib/daemon-clone-registry.mjs#daemonCloneRoots`/`#isDaemonCloneRealpath`
   asserting a path under `<workspace>/wev-control` resolves as a registered clone.
2. A unit/integration test driving `we:scripts/guard-bash.mjs` and `we:scripts/guard-lane.mjs` with cwd (or a
   target path) inside a fixture `wev-control`-named clone, asserting the write is refused the same way a
   write into `wev-review-daemon` already is.
3. A regression on `we:scripts/review-set-label.mjs#fileApprovalPreventionCard` (or the shared filer it calls)
   from a fixture checkout shaped like `wev-control` (no `lane/*` branch, cwd matches a registered
   daemon/control clone) asserting it refuses to write the card there instead of leaving an untracked file.
4. A unit test for the new health smell (alongside `we:scripts/conveyor/health-smells/clone-stale.mjs`,
   registered in `we:scripts/conveyor/health-smells/index.mjs`) asserting it opens an episode for a fixture
   control clone carrying uncommitted/untracked changes, and closes once the clone is clean.

## Tasks

1. Add `wev-control` to `we:scripts/lib/daemon-clone-registry.mjs`'s `DAEMON_CLONE_SEED` (or a parallel
   control-clone seed list if the fix keeps daemon and control clones as distinct kinds).
2. Make `we:scripts/review-set-label.mjs#fileApprovalPreventionCard` (and any other approval/prevention filer
   sharing its write path) consult the registry and refuse to write into any daemon or control clone —
   mirroring the existing `we:scripts/guard-lane.mjs`/`we:scripts/guard-bash.mjs` refusal rather than
   re-deriving it.
3. Add a health smell, alongside `we:scripts/conveyor/health-smells/clone-stale.mjs`, that fires on a dirty
   `wev-control` (uncommitted or untracked changes) so the build daemon's stale-rebuild failure mode
   (`we:backlog/4317-approval-time-prevention-cards-are-written-into-the-daemon-c.md`'s "rebuild did not move
   the clone (dirty)") is caught before it silently runs stale code, and register it in
   `we:scripts/conveyor/health-smells/index.mjs`.

## Proof plan (live, before/after)

- BEFORE: Test plan #1–#3 fail (a write into `wev-control` succeeds unguarded, exactly as it did on
  2026-09-28 for both `x21soye`/#4314 and `xx604u2`); Test plan #4's smell fixture reports no episode for a
  dirty control clone.
- AFTER: the same tests pass, and the new smell fires red against a fixture dirty `wev-control` and green once
  it is clean — both runnable via `npm run check:standards`/`vitest` with no manual clone surgery.

## Done when

1. **Executable** — the Test plan #1–#4 regressions all fail before this item lands and pass after, runnable
   via `npm run check:standards`/`vitest` with no manual daemon-clone surgery.
