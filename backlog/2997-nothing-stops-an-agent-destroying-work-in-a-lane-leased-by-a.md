---
bornAs: x9nlwgi
kind: task
status: active
dateOpened: "2026-08-08"
dateStarted: "2026-08-14"
tags: [gate, footgun, lane]
scope:
  - we:scripts/guard-lane.mjs
  - we:scripts/guard-bash.mjs
  - we:scripts/lib/lane-lease.mjs
  - we:scripts/lane-pool.mjs
  - we:scripts/backlog.mjs
  - we:scripts/mine-golden-corpus.mjs
  - we:scripts/__tests__/guard-lane.test.mjs
  - we:scripts/__tests__/guard-bash.test.mjs
  - we:scripts/__tests__/golden-corpus-snapshot.test.mjs
  - we:scripts/lib/__tests__/lane-lease.test.mjs
  - we:scripts/golden-corpus/hook-guard-lane/
  - we:scripts/golden-corpus/hook-guard-bash/
scopeRationale: >
  File-level for the code touched, grounded in a real importer grep, not a guess. we:scripts/guard-lane.mjs
  is Gap 1 (PreToolUse Edit|Write has no lease read at all — laneGuardDecision(real, weRoot) arity proves
  it). we:scripts/guard-bash.mjs is Gap 2 (widen the per-holder signal past the workflowLane marker; also
  the only place readLaneLease/laneRootFromCwd/isForeignLease live today, and readLaneLease at
  we:scripts/guard-bash.mjs:1548 is NOT currently exported, so exporting it for we:scripts/guard-lane.mjs
  to reuse touches this file regardless of which Gap-2 option is picked). we:scripts/lib/lane-lease.mjs is
  the shared pure lease-decision core both guards already import (isForeignLease, leaseOwnedByCaller,
  leaseBody) and is where a widened per-holder contract would live. we:scripts/lane-pool.mjs is IN because
  cmdAcquire/tryClaimLane mints the lease body (leaseBody) at acquire — Gap-2 option (a), minting a slug on
  every acquire not just workflow-lane, is a we:scripts/lane-pool.mjs change. we:scripts/backlog.mjs:50
  imports {laneGuardDecision, resolveReal} from we:scripts/guard-lane.mjs directly (writeBacklogMd's
  primary-checkout guard) — a real, signature-sensitive importer, not just a hook consumer.
  we:scripts/mine-golden-corpus.mjs:32 imports {decide} from we:scripts/guard-bash.mjs to mine the
  hook-guard-bash fixtures; new foreign-lease/unmarked-sibling deny cases need new mined fixtures, hence it
  and both golden-corpus fixture dirs (new fixture JSON, filenames not yet known — directory-level is the
  honest prediction) plus we:scripts/__tests__/golden-corpus-snapshot.test.mjs (replays those fixtures) are
  IN. The two __tests__ files pin the two guards' pure decision functions directly and gain new
  must-deny/must-allow cases per the card's "Done when" (pin the 3-row repro table as a fixture).
  ---
  Importers investigated and explicitly EXCLUDED (grep across we:scripts/ + we:.claude/settings.json):
  we:scripts/lib/converge-transports.mjs:25 imports laneRootFromCwd from we:scripts/guard-bash.mjs — pure
  cwd→lane-root path helper, not a deny/allow decision; this fix does not change what counts as "in a
  lane", only whether a lease inside it is foreign. we:scripts/lane-stack.mjs,
  we:scripts/converge-daemon-pass.mjs, we:scripts/conveyor/lease-reaper.mjs import only stable
  staleness/const exports from we:scripts/lib/lane-lease.mjs (LEASE_FILENAME, isLeaseStale,
  isReservedLease, DEFAULT_LEASE_TTL_MINUTES) — unrelated to the foreign-lease ownership gap this item
  targets. we:scripts/readiness/scope-lease.mjs, we:scripts/readiness/scope-lease-live.mjs,
  we:scripts/lib/lane-verify.mjs, we:scripts/lib/review-independence.mjs only mention
  we:scripts/lib/lane-lease.mjs in comments — no actual import. we:.claude/settings.json already points
  both PreToolUse hooks at these two file paths by stable command string ("node
  we:scripts/guard-lane.mjs" / "node we:scripts/guard-bash.mjs"); no hook-registration change needed since
  neither script's path moves. we:scripts/lib/judge-spawn.mjs and we:scripts/guard-lane-install.mjs only
  reference we:scripts/guard-lane.mjs in comments/path-construction, no functional import of its decision
  logic.
  ---
  Guard coverage verified BEFORE scoping (2026-08-13, against this lane's checkout):
  we:scripts/guard-bash.mjs (line ~1548-1574, isForeignLease at we:scripts/lib/lane-lease.mjs) DOES deny
  a destructive git op (reset --hard/clean -fd/force-push) in a lane holding a foreign SESSION's live
  lease (#2367) or an unmarked-sibling's live lease when the lease carries the workflowLane marker
  (#2413, fail-closed). It does NOT deny the same op from a sibling agent sharing the acquiring session's
  own ownerSession under an UNMARKED lease (Gap 2 — confirmed live: only --purpose=workflow-lane sets
  workflowLane; conveyor-prepare-*/conveyor-delivery/ad-hoc acquires are unmarked).
  we:scripts/guard-lane.mjs (laneGuardDecision(real, weRoot)) reads no lease/session/owner at all — its
  whole decision is primary-vs-lane path classification (Gap 1, confirmed by the function's own arity and
  doc comment: "the words lease / owner / foreign do not appear in it"). we:scripts/lane-pool.mjs's OWN
  acquire/refresh/provision/release commands are NOT part of either gap: acquire (tryClaimLane) and
  refresh/provision (isLaneAcquirable) already refuse to touch a live-leased lane, and release
  (leaseOwnedByCaller) already gates on ownership — the hole is only ad-hoc Bash/Edit/Write run BY an
  agent INSIDE an already-acquired lane clone, not we:scripts/lane-pool.mjs's own commands.
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

### 2026-08-14 — it happened, in ordinary use, not in a probe

Not a re-confirmation this time. During normal delivery work a subagent finished its task and ran
`we:scripts/lane-pool.mjs release --lane=5`, intending to release its own lease
(`Mac:39367 file-memory-rewrite-gap`). **It released a different concurrent holder's lease**
(`Mac:39423 review-1222-r2`) and the pool accepted it, because both leases carried the same parent
`CLAUDE_CODE_SESSION_ID` and the ownership check resolved to "same session, therefore mine".

Nothing was lost — the review that held lane-5 had already finished, and the tree was clean at the
releasing agent's own commit. That is luck, not a guard. Had the review still been mid-run, its lane
would have been returned to the pool and reissued to the next `acquire` while it was still working in
it.

Two things this adds to the analysis above:

- the hazard is not confined to `reset --hard` / destructive ops. **`release` is enough**, because a
  released lane is immediately re-issuable, and the next holder's `acquire` resets it;
- it reached a real agent doing real work with no probe, no unusual topology and no override flag —
  just two ordinary subagents of one session, which is now the default shape of a delivery session.

The releasing agent noticed and reported it. Nothing in the system did.

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

## Ruling (2026-08-14, delivered)

**The per-holder slug is minted on EVERY acquire (option (a)), but the fail-CLOSED regime it enables is armed
only where the ambient signal is provably ambiguous.** `we:scripts/lane-pool.mjs` stamps a `holder` slug into
every lease and prints it to the acquirer; `we:scripts/lib/lane-lease.mjs` gains `isContestedLease` — "does
another LIVE lease in this pool carry the same `ownerSession`?", i.e. is a sibling agent of my own session
holding a lane right now. That predicate is the exact, script-decidable statement of "the durable session id
cannot answer here", and it is what keeps the closure off the normal flow:

- **uncontested** (one session, one lane): nothing changes. The #2367 `ownerSession` compare genuinely
  distinguishes owner from foreigner, so no assertion is asked for. Pinned by must-ALLOW tests on both paths.
- **contested**: the op must assert the lease's minted slug — `LANE_SESSION=<slug>` inline for a destructive
  git op, `--session=<slug>` for a `release`. Absent or mismatched ⇒ deny, naming the slug and the remedy.

Option (c) was re-probed as the card asked and rejected: the environment a subagent's Bash call sees carries
`CLAUDE_CODE_SESSION_ID` (identical to the parent's), `CLAUDE_CODE_CHILD_SESSION=1` (a boolean, not an id) and
`CLAUDE_PID` (the shared CLI process) — no per-subagent id. #2413's ratified statute holds.

**`release` is closed, not only the destructive ops.** The 2026-08-14 occurrence was a `release`, and a released
lane is immediately re-issuable, so `leaseOwnedByCaller` refuses its `ownerSession` fallback on a contested
lease. `--force` still breaks any lease, so the operator's stale-lane cleanup and the lease-reaper (which always
passes `--force`) are untouched, as is the drain's by-item `release --all-pools`.

**A lane with NO live lease stays fully writable and releasable.** The lease IS the ownership signal; with no
lease there is no holder to protect, and the pool's own flows (provision, refresh, an operator inspecting a free
lane) all operate on unleased clones. A stale lease reads as no lease, everywhere.

**Known residual, recorded deliberately.** Gap 1 (`Edit`/`Write`) closes the cross-SESSION hole only. The
sibling case needs a per-operation assertion channel, which a Bash command string has and a file tool
structurally does not — so an `Edit` into a sibling's lane still passes. Noted in `we:scripts/guard-lane.mjs`'s
header. A lease minted before this shipped carries no `holder`, so it keeps the pre-#2997 fail-open behaviour
rather than becoming unreleasable.

## Ruling amended (2026-08-14, r2 — after independent review of PR #1234)

The review found the first cut of Gap 1 **wrong in the ordinary case**, plus two narrower defects. All four
corrections are in the same PR; the r1 ruling above stands except where amended here.

**Gap 1 keys on a DECLARED OCCUPANT, not on `ownerSession`.** `acquire` stamps `ownerSession` from the env of
the process that RUNS it. That is the working agent when an agent leases its own lane (the conveyor/dispatch
brief's step 1), and the **dispatcher** when an operator leases a lane and hands the path to a spawned agent —
which is the live shape of this pool. A reader of the marker cannot tell the two apart, so
`ownerSession !== mySessionId` does not mean "someone else is working here"; for a dispatched lane it is true
**by construction for that lane's own legitimate occupant**. As written, Gap 1 would have made every dispatched
lane read-only for the agent sent to work in it, with the deny naming a lease whose `purpose` was minted *for*
that agent. So the signal is split rather than patched:

- `ownerSession` keeps its meaning — "who ran `acquire`" — and the #2367/#2452 `release` rules are untouched.
- **Occupancy is its own lease field, `workerSession`**, written only by a session claiming the lane for
  itself: `acquire --adopt`, or the new `we:scripts/lane-pool.mjs adopt --lane=N` hand-off command the worker
  runs after a dispatcher leased the lane for it. `isForeignOccupancy` is what `we:scripts/guard-lane.mjs` now
  reads.
- **Consequence, stated plainly:** protection is per-lane opt-in. A lane whose occupant was never declared is
  NOT refused — it stays writable exactly as on `main`. That is the deliberate trade: an undeclared lane cannot
  be distinguished from a dispatched one, and a false DENY that locks an agent out of its own lane is strictly
  worse than the silent-write hole it would be closing.

**A STALE lease is never CONTESTED.** `release` staleness-checked the siblings but not the subject lease, so an
expired lease with a live same-`ownerSession` sibling became unreleasable without `--force` — contradicting this
card's own "a stale lease reads as no lease, everywhere" on the one path that ruling is about. Fixed and pinned.

**The contested scan is CROSS-POOL** (`we:scripts/guard-bash.mjs`'s `siblingLaneLeases`,
`we:scripts/lane-pool.mjs`'s `liveLeasesInPoolExcept`): a session's siblings routinely hold lanes in different
pools, and the ambient id is exactly as ambiguous there.

**Scope of the Gap 2 closure, qualified (this supersedes the unqualified "Done when" below).** The contested
arm needs a SECOND live lease to exist. A sibling agent that holds **no lane of its own** — a lane-less review
subagent, say — leaves nothing to find, so a lane whose holder is its session's only holder reads UNCONTESTED
and a destructive op there is still ALLOWED. **The 2026-08-08 incident is therefore covered only if another
lane was live under the same `ownerSession` at that moment; in the sole-holder shape it is NOT closed by this
item.** Closing it would mean demanding the minted slug for every destructive op in every leased lane — a
fail-closed default whose false-deny cost lands on every ordinary solo flow, and which this item does not take.

## Done when

- An `Edit`/`Write` to a file inside a lane **another session has declared it is working in** (`workerSession`,
  set by `adopt` / `acquire --adopt`) is REFUSED, with a message naming the holder and the remedy. (Gap 1.)
  A lane with no declared occupant stays writable — see the r2 amendment for why that is deliberate.
- A destructive git op in a lane held by a **sibling agent of the caller's own session** is REFUSED
  under an **unmarked** lease, not only under a `workflowLane`-marked one (Gap 2) — **when that sibling holds a
  live lane of its own, in any pool.** The sole-holder shape is out of scope, per the r2 amendment.
- Your OWN lane is unaffected on both paths — no new friction on the normal flow. Pin this with a
  must-ALLOW test, not only a must-deny one.
- The existing #2367 cross-session deny and #2413 marked-lane fail-closed deny both still pass
  unchanged; the three-row repro table above becomes a test fixture.
- A lane with no lease at all behaves per whatever this item's ruling decides, and the ruling is
  recorded.
