---
bornAs: xdby58u
kind: story
size: 3
parent: "2405"
status: open
dateOpened: "2026-08-08"
relatedTo: ["3002", "2749", "2123", "2335"]
scope: ["we:scripts/guard-bash.mjs", "we:scripts/__tests__/guard-bash.test.mjs"]
tags: [guard, lane-isolation, git, fail-closed, footgun]
---

# Guard destructive git at the primary checkout — require an explicit lane cwd, deny when unresolvable

The lane-isolation rule (#2123, "nothing ever splices to primary" #2339) is enforced against every
instrument **except the most destructive one**. Observed 2026-08-08: a `git reset --hard origin/main`
intended for a lane clone ran against the primary checkout, because the command carried no explicit `cd`
and the shell's working directory had reverted. It happened to be a fast-forward on a clean tree, so
nothing was lost — but nothing in the guard set would have stopped the version that discards work.

## The coverage hole, verified

| target | Edit/Write tool | `sed -i` / redirect | `git reset --hard` |
| --- | --- | --- | --- |
| primary checkout | denied (`we:scripts/guard-lane.mjs`) | denied (`we:scripts/guard-bash.mjs`) | **allowed** |
| a lane another session holds | — | — | denied (`LANE_CLOBBER_OK`) |
| the session's own lane | allowed | allowed | allowed + staleness check |

[`we:scripts/guard-lane.mjs`](../scripts/guard-lane.mjs) is a `PreToolUse(Edit|Write)` hook — it never sees
Bash. [`we:scripts/guard-bash.mjs`](../scripts/guard-bash.mjs) covers tree-writes and backlog mutations at
the primary but has no `reset` / `clean` / `restore` handling at all. So the one cell that is open is the
one that can wipe a tree in a single command.

## Arm A — deny when the target checkout is unresolvable (the real fix)

This is #3002's ruling applied one level up: the guard could not resolve *which checkout* the command
targeted, and resolved that ambiguity by **allowing**. Invert it.

- Require an explicit leading `cd <lane-path>` for any **tree-mutating** git command (`reset`, `clean`,
  `checkout -- …`, `restore`, `push --force`). The convention already exists and the guard already resolves
  a leading `cd` (#2335) — guard-bash's own error text instructs callers to write commands this way. It is
  simply not enforced for git.
- With no explicit `cd`, the target is unresolvable ⇒ **deny**, with the same message that already teaches
  the `cd <lane-path> && <cmd>` form.
- Script-decidable (a path test on a resolved cwd), so per rule #51 it belongs in the hook rather than in
  agent judgment.

**This is the arm that would have caught the observed incident.** Arm B would not have.

## Arm B — fast-forward-only carve-out at the primary (the backstop)

Destructive git at the primary is denied **unless it is a pure fast-forward**:

- `git merge-base --is-ancestor HEAD origin/main` is true, **and**
- the tracked tree has no modifications.

This keeps `we:scripts/pr-land.mjs`'s legitimate post-land primary sync working (it ff-syncs unless
`--no-sync-primary`) while blocking any variant that would discard local commits or dirty tracked files.

**Be honest about what this buys:** the observed incident *was* a fast-forward on a clean tree, so Arm B
would have allowed it — correctly, since nothing was lost. Arm B exists for the day the same slip lands on
a primary that is not clean.

## Rejected

- **A confirmation prompt.** A bypass that becomes routine trains everyone to click through — the same
  argument that sank the `env -u CLAUDE_CODE_SESSION_ID` option in the review-independence decision.
- **"The agent should be more careful."** Not a control. The whole point of #51 is that a script-decidable
  rule does not live in model recall.
- **Making the primary physically read-only.** Breaks the pr-land sync and the dev server for no gain over
  Arm A.

## Note on the trigger — out of scope here

Why the working directory reverted is unknown. The Bash tool documents cwd persistence across calls, and it
held earlier in the same session; a later call without a `cd` landed on the primary anyway. Arm A makes the
answer irrelevant — which is the point — so this item does not chase it. If the reversion turns out to be
reproducible, file that separately as a harness bug.

## Acceptance

- A tree-mutating git command with no explicit leading `cd` **denies**, naming the `cd <lane-path> && <cmd>`
  form.
- The same command with an explicit `cd` into a lane the session holds **clears**.
- `git reset --hard origin/main` at the primary clears when HEAD is an ancestor of `origin/main` and the
  tracked tree is clean; denies when either fails.
- `we:scripts/pr-land.mjs`'s primary ff-sync still clears end to end.
- Golden-corpus rows added under `we:scripts/golden-corpus/hook-guard-bash/` for each case above.
- Fold into #1092's guard rework rather than shipping a competing arm — same file, same doctrine.
