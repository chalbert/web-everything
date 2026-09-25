---
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/operations/heavy-queue.mjs", "we:scripts/operations/heavy-queue-io.mjs", "we:scripts/operations/run.mjs", "we:skills-src/queue/SKILL.md", "we:.claude/commands/queue.md", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/readiness/__tests__/heavy-admission.test.mjs", "we:scripts/operations/__tests__/heavy-admission-contention.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Heavy-queue report: declared operation + /queue skill/command, and heavy-admission FCFS fairness fix

Operator request 2026-09-25: make the hand-built heavy-admission-queue report mechanical. Adds a declared,
read-only `heavy-queue` operation (following we:scripts/operations/daemon-status.mjs's #4067 pattern) plus a
`/queue` skill+command, and separately fixes a live FCFS-fairness bug in
we:scripts/readiness/heavy-admission.mjs (a newer waiter could win a freed slot ahead of an older one). It
also carries a report (not a fix) on why lanes forked before PR #2680 still run the old full-suite gate. See
the "Report" section below for the fairness incident and the old-base finding, each with live evidence.

## Done when

1. **Executable** — `node we:scripts/operations/run.mjs heavy-queue --json` exists and reports `held`/`waiting`
   rows with `state`/`lane`/`who`/`kind`/`minutes`/`projectedWaitMinutesForNewJob` against the real queue.
2. **Skill + command** — `we:skills-src/queue/SKILL.md` + `we:.claude/commands/queue.md` exist and `/queue`
   runs the operation and presents the table.
3. **Fairness, red→green** — a vitest fairness test in `we:scripts/readiness/__tests__/heavy-admission.test.mjs`
   (3 waiters, oldest live one by `requestedAt` wins each freed slot) fails against `main`'s current
   slot-0-then-slot-1 scan and passes once `we:scripts/readiness/heavy-admission.mjs` enforces FCFS.
4. `npm run check:standards` and the affected vitest files are green.

## Fairness fix

`we:scripts/readiness/heavy-admission.mjs`'s slot acquisition was "try slot-0, then slot-1 …, poll every
2s" — any waiter could win a freed slot regardless of arrival order. Observed live: a `check:standards`
waiter on lane-16 waited 47+ minutes while newer jobs took slots ahead of it. Fixed to first-come-first-served
(only the OLDEST live waiter, by `requestedAt`, ignoring stale/dead waiters, may take a free slot); existing
PID-liveness + lease-TTL reclaim is unchanged. Proven red before the fix, green after
(`we:scripts/operations/__tests__/heavy-admission-contention.test.mjs`).

## Report: why old-base lanes still run the full suite (not fixed here)

Grounded 2026-09-25 against the LIVE pool via the new `heavy-queue` operation itself: at the time of this
run, lane-21 and lane-24 were both classified `kind: FULL` (running `node we:scripts/verify-lane.mjs run
--repo=.` unconditionally), while lane-11/13/20 were `selected` (the diff-driven default gate, PR #2680). A
direct check confirms why: `git -C lane-21 merge-base --is-ancestor 14a3d0dff HEAD` and the same for lane-24
both fail — those two clones are 111-120 commits behind `origin/main` and were forked BEFORE PR #2680
(`lane/xpnhz4o-local-gate-selected-tests`, merge `14a3d0dff`) merged the diff-driven default gate (#3372).
lane-11/13/20 all pass the same check.

**Root cause: every hook and script a session runs is loaded from that session's OWN checkout, and nothing
re-syncs a lane's checkout when `main` changes underneath it.** `we:.claude/settings.json`'s Bash `PreToolUse`
hook is wired as a bare relative path — the JSON value is `node ` followed by `we:scripts/guard-bash.mjs`'s
own bare form (no locus prefix in the real config, added here only for this doc's own lint) — which Claude
Code resolves against the CURRENT working directory, i.e. whichever lane clone the session is standing in. A
lane forked before a fix landed on `main` (a new guard-bash deny rule, or here, `we:scripts/verify-lane.mjs`'s
own diff-driven gate) keeps running ITS OWN stale copy of that file indefinitely — there is no mechanism that
pulls a `main` fix into an already-forked, already-dispatched lane mid-flight. This is not specific to
`we:scripts/verify-lane.mjs`; it is a structural property of every hook command configured as a bare relative
path (`we:scripts/guard-bash.mjs`, `we:scripts/backlog-guard.mjs`, `we:scripts/guard-backward-edge.mjs`, …) and
of every script a dispatched session shells directly from its own tree.

**Proposed mechanical fix (not built here — report only, per this card's own instruction):** resolve hook
commands in `we:.claude/settings.json` from a STABLE, CURRENT path rather than the lane-relative one — e.g.
resolve against a fixed, always-synced checkout, or (if Claude Code's own `$CLAUDE_PROJECT_DIR` names the true
project root rather than the lane) a small wrapper hook that `require`s/execs the CURRENT `origin/main`'s copy
instead of the lane's own working tree. Whichever shape is chosen, it only closes the GUARD-side gap (a hook
enforcing a NEW rule reaching old lanes); it does not, by itself, make `we:scripts/verify-lane.mjs`'s OWN
diff-driven-gate code reach an already-forked lane's own checkout — that would need either a periodic
rebase-onto-`main` for long-lived lanes, or `we:scripts/verify-lane.mjs` sourcing its gate-selection logic from
a stable location rather than its own lane-local file. Left as an open follow-on, not built here.
