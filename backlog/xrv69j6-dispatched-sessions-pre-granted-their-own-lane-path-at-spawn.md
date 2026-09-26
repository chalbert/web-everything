---
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/lib/gh-app-shim.mjs", "we:scripts/conveyor/health-smells/"]
dateOpened: "2026-09-26"
tags: []
---

# Dispatched sessions pre-granted their own lane path at spawn (no unanswerable permission prompt)

Since #2701/#4174 a dispatched session starts in a scratch cwd (~/workspace/.operations/dispatch/<uuid>)
outside every checkout. Its brief's first real step (we:scripts/lane-pool.mjs acquire) then Edits/Writes into a lane
clone that is neither the session's cwd nor a pre-granted additional directory, so Claude Code's own
outside-cwd Edit/Write permission gate asks a question nobody is there to answer -- a --bg session with no
human attending just sits blocked on a permission prompt forever. Live case: fix-2735's fixer sat 36+ min
blocked on an Edit to lane-34/we:scripts/operations/__tests__/review-red-team.test.mjs (2026-09-26, ~13:28
ET), stalling PR #2735 (review-status:fix-stalled). Not a one-off: we:scripts/operations/dispatch-lane.mjs's
own 'assigned-lane' guard THROWS if launch.lane is null/empty for ANY of the six launch kinds
(build/prepare/prepare-decision/investigate/fix/ci-heal), so the lane a dispatch will use is always knowable
before the agent is spawned, not merely discoverable after.

Fix: at the moment we:scripts/operations/dispatch-lane-io.mjs#createDispatchSinks spawns the agent, compute
that lane's absolute directory from payload.lane (the same pool-probing CONSTELLATION_REPOS.we.dirs
join(.lanes/<dir>/lane-<N>) pattern we:scripts/bootstrap-session.mjs's poolRoots/trustableDirs already use)
and merge it into <sessionCwd>/we:.claude/settings.local.json's permissions.additionalDirectories plus explicit
Edit()/Write() allow rules for that one lane -- the SAME durable per-cwd settings file
resolveDispatchSettingsEnv/ensureSettingsFileEnv (we:scripts/lib/gh-app-shim.mjs) already writes the gh-shim
env into, extended with a permissions merge alongside the env merge. Grants exactly the ONE lane this
dispatch will use -- never the lanes root broadly, and never a primary checkout. Defensive fallback (should
not fire given the assigned-lane guard, but a caller could still hand the sink a null lane directly): grant
the lanes root instead of refusing to grant anything.

Also add a narrow health-watch smell (we:scripts/conveyor/health-smells/, same plugin registry
we:scripts/conveyor/health-smells/daemon-held-on-last-good.mjs already extends) flagging a `claude agents --json` entry with waitingFor:
'permission prompt' aged past 10 minutes, so a stalled dispatch is operator-visible without polling. Narrow
slice of the fuller treatment #3149 and #4191 already scope (PR comments, operator-queue, reconcile-core
notes) -- relatedTo both, not a duplicate of either.

Proof: vitest red->green over the settings-merge function (additive, idempotent, never-throws, matching
ensureSettingsFileEnv's own contract) and the lane-path derivation (given a lane number, resolves the same
absolute path we:scripts/lane-pool.mjs itself would clone into). Live: after loading via we:scripts/daemon-overlay.mjs, a newly
dispatched fixer/builder edits a file in its lane with no permission prompt.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
