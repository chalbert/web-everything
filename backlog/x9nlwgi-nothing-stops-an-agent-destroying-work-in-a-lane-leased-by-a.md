---
kind: task
status: open
dateOpened: "2026-08-08"
tags: [gate, footgun, lane]
---

# Nothing stops an agent destroying work in a lane leased by a sibling of its own session — and Edit/Write has no lease check at all

The Bash-side lane-clobber guard shipped (#2367, refined #2413) and works. Two holes remain: the
`Edit`/`Write` guard has no notion of a lease at all, and the Bash guard's ownership compare is
SESSION-level, so concurrent agents *inside one session* all read as the owner of each other's lanes.

## The near-miss (2026-08-08)

A read-only review subagent had a directory mix-up and ran `git reset --hard` inside
`lane-1`, which at that moment held a **live lease** and three commits of in-progress work for
PR #984. Nothing refused the command. The agent noticed, recovered the tip from `git reflog`, and
nothing was lost — but only because it happened to check. Had the work been uncommitted rather than
committed, the reflog would not have saved it.

The lease `lane-1` held belonged to the **same session** as the subagent that clobbered it. That is
the whole explanation, and it is why the guard stayed silent.

## What already exists (prior art — do not re-discover it)

- **#2367 (resolved)** put a destructive-git-op guard on `Bash`. `we:scripts/guard-bash.mjs` computes
  `isLaneCwd(cwd) && hasDestructiveLaneOp(cmd)`, and on a hit reads the lane's `.git/.lane-lease` and
  denies via `isForeignLease` (`we:scripts/lib/lane-lease.mjs`). It covers `reset --hard`,
  `clean -f[d]`, discarding `checkout`/`restore`/`switch`, and force-push, normalised past wrapper and
  path disguises by `canonicalGitOp`. Escape: `LANE_CLOBBER_OK=1`.
- **#2413 (resolved)** added the fail-CLOSED regime for lanes whose lease is MARKED (`workflowLane:
  true`, set by `acquire --purpose=workflow-lane`): the op must assert the lease's own minted slug
  inline (`LANE_SESSION=<slug>`); absent or mismatched ⇒ deny. It exists precisely because ambient
  session identity cannot separate siblings.

Both are real and both fire. Verified by repro against the shipped guard, using a throwaway
`.lanes/<repo>/lane-N` fixture and a synthetic lease:

| lease | my session id | destructive op | result |
|---|---|---|---|
| unmarked, `ownerSession: OTHER` | `MINE` | `git reset --hard HEAD~3` | **DENY** (#2367) |
| marked `workflowLane`, no slug asserted | `MINE` | same | **DENY** (#2413) |
| unmarked, `ownerSession: MINE` | `MINE` | same | **ALLOW** ← the gap |

## Gap 1 — the `Edit`/`Write` path has no lease check at all

`we:scripts/guard-lane.mjs` is the `PreToolUse(Edit|Write)` gate. Its whole decision is
`laneGuardDecision(real, weRoot)`: deny when the target realpaths under a constellation PRIMARY
checkout and not under `.lanes/` (#2123). It takes no lease, no session id, and no owner — the
function's arity is literally `(real, weRoot)`, and the words `lease` / `owner` / `foreign` do not
appear in it. Confirmed by calling the pure decision directly:

- a file in the shared primary → DENY
- a file in **my** lane → ALLOW
- a file in a **foreign-leased** lane → ALLOW

So an `Edit` on a tracked file inside a lane another session is actively working in succeeds
silently. `Edit` overwrites without a reflog entry, so this is strictly worse than the Bash case the
guard already covers: there is nothing to recover from.

## Gap 2 — the Bash guard's ownership signal is SESSION-level, not agent-level

`isForeignLease({lease, mySessionId})` returns `lease.ownerSession !== mySessionId`, where
`mySessionId` is `process.env.CLAUDE_CODE_SESSION_ID || ev.session_id`. **A spawned subagent inherits
its parent's `CLAUDE_CODE_SESSION_ID` verbatim** — #2413 established this empirically and its
ratified statute says no ambient env or process property can tell siblings apart. Re-confirmed while
writing this item: a subagent's `CLAUDE_CODE_SESSION_ID` matched the parent session's id exactly, and
`we:scripts/lane-pool.mjs acquire` stamped that same id into the lease it minted.

Therefore a lane leased by session `S` is **not foreign** to any other agent of session `S`. With
eight subagents live in one session, each holding a lane, every one of them can freely `reset --hard`
every other one's lane and the guard is behaving exactly as specified.

**This is a scope residual of #2413, not intended behaviour.** #2413 built the right answer — a minted
per-holder slug asserted with each operation and checked at the point of use — but gated it on the
`workflowLane` marker, and explicitly recorded that "the degraded fail-open behavior is unchanged for
**unmarked** leases". Only `--purpose=workflow-lane` sets that marker, i.e. only the parallel
`/workflow` template. Every other concurrent topology takes an **unmarked** lease and falls back to
the session compare:

- ad-hoc subagent `acquire`s — the incident above;
- the conveyor, which dispatches concurrent lanes as `conveyor-delivery` / `conveyor-fix` /
  `conveyor-prepare-*`.

The neighbouring `release` path already recognised this: #2452 gated its `ownerSession` fallback
behind `targeted` for exactly this reason, noting that `ownerSession` answers "same session", never
"this lane". The destructive-op guard has no equivalent, so the same unmarked-sibling hazard is still
open there.

## What to consider

- **Gap 1**: give `we:scripts/guard-lane.mjs` the lease read `we:scripts/guard-bash.mjs` already has.
  Deny an `Edit`/`Write` whose target sits inside a lane whose live lease is not the caller's, for the
  same reason it already refuses the primary. Reuse `readLaneLease` + `laneRootFromCwd` +
  `isForeignLease` rather than re-implementing them; the two guards must not drift on what "your lane"
  means.
- **Gap 2**: widen the per-holder signal past the `workflowLane` marker. Options, roughly in order of
  cost: (a) have every `acquire` mint a slug and stamp it, so the fail-closed regime becomes the
  default rather than opt-in; (b) mark the conveyor's purposes too, which closes the named topology but
  leaves ad-hoc lanes open; (c) key on the hook payload's per-subagent `agent_id`, which #2413 named
  and excluded as experimental and unprobed — re-probe before betting on it.
- Decide what an agent holding **no** lease at all should be allowed to do in a lane — today it is
  everything. A read-only review agent arguably should not be writing to any lane.
- Whatever the rule, the deny message must name the remedy (assert your slug, or acquire your own lane)
  rather than just refusing, or it becomes the next false-deny footgun — see #2986 and #2994 for what
  that costs. #2413's marked-lane message is the model: it prints the exact slug to re-assert.

## Reader's note

`we:scripts/guard-bash.mjs` contains a **NUL byte**, so `grep` classifies it as binary and reports
nothing at all — no matches, and not even a count for `-c`. That is how the first pass at this item
concluded the Bash guard had no lease logic when it has four references to `isForeignLease`. Use
`grep -a` on that file. Worth removing the NUL byte at some point; until then, treat a silent grep of
it as a false negative.

## Done when

- An `Edit`/`Write` to a file inside a lane whose live lease is not the caller's is REFUSED, with a
  message naming the holder and the remedy. (Gap 1.)
- A destructive git op in a lane held by a **sibling agent of the caller's own session** is REFUSED
  under an **unmarked** lease, not only under a `workflowLane`-marked one. (Gap 2.)
- Your OWN lane is unaffected on both paths — no new friction on the normal flow. Pin this with a
  must-ALLOW test, not only a must-deny one.
- The existing #2367 cross-session deny and #2413 marked-lane fail-closed deny both still pass
  unchanged; the three-row repro table above becomes a test fixture.
- A lane with no lease at all behaves per whatever this item's ruling decides, and the ruling is
  recorded.
