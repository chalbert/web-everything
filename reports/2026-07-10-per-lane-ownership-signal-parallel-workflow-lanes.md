# Per-lane ownership signal for parallel `/workflow` lanes — grounding report

**Date:** 2026-07-10 · **Grounds:** backlog #2413 (prep pass) · **Upstream:** #2367 (destructive-git-op
guard, PR #342), #2275 (exclusive lease allocator), #2183 (parallel PR-fan-out model)

## The question

The #2367 guard denies a destructive git op (`reset --hard`, `clean -f[d]`, discard-checkout, force-push)
run inside a lane clone whose live lease is held by *another* session. It protects the **serial** topology
(two top-level sessions) but not the **parallel `/workflow`** topology: parallel lanes carry **no lease at
all**, and even if they did, sibling lane agents share every ambient identity signal. #2413 asks how the
lane-dispatch machinery should stamp a per-lane lease with a per-lane identity so the guard has something
to check.

## Code grounding (all refs verified 2026-07-10 @ origin/main)

**The guard and its comparison:**

- The deny rule fires on `!primaryCwd && foreignLiveLease && isDestructiveLaneGitOp(s)` with a
  command-string escape — [we:scripts/guard-bash.mjs:253](../scripts/guard-bash.mjs) tests
  `!/\bLANE_CLOBBER_OK=1\b/.test(s)`. The sibling `STALE_LANE_OK=1` escape at we:scripts/guard-bash.mjs:238
  uses the same pattern. **The guard already parses per-op assertions out of the command string** — this
  is the established channel.
- Ownership is `isForeignLease` (we:scripts/lib/lane-lease.mjs:96-100): foreign iff
  `lease.ownerSession !== mySessionId`, where both sides read `CLAUDE_CODE_SESSION_ID`. Degraded (either
  side missing) ⇒ fail-open (allow), by design (r2 removed the pid-ancestry fallback that over-matched
  shared-ancestor topologies).
- The guard recovers the *effective* cwd from a leading `cd <lane>` in the command
  (`resolveEffectiveCwd`, we:scripts/guard-bash.mjs:185-210), so the standard lane idiom is classified
  correctly.

**The lease allocator:**

- `tryClaimLane` (we:scripts/lane-pool.mjs:533-563) writes the marker atomically (`O_EXCL`) with
  `session` (the `LANE_SESSION` slug), `purpose`, TTL, and `ownerSession = process.env.CLAUDE_CODE_SESSION_ID`
  (we:scripts/lane-pool.mjs:545). A live foreign lease is not overridable (#2337 (b)); a stale one is
  reclaimed; one's own is refreshed idempotently — keyed on the **`session` slug** (`leaseOwnedBy`,
  we:scripts/lib/lane-lease.mjs:111-113).
- `acquire --lane=N` targets an explicit lane and fails loudly if it is held
  (we:scripts/lane-pool.mjs:589-606). After claiming, acquire **readies the lane**: fetch, `reset --hard
  origin/<branch>`, `clean -fd`, lane-env regen, deps (we:scripts/lane-pool.mjs:626-634) — *exactly* the
  work the parallel lane prompt's step-1 prep does by hand.
- `provision`/`refresh` (we:scripts/lane-pool.mjs:482-517) write **no** lease marker.

**The parallel workflow:**

- The orchestrator provisions pools and couples item↔lane **by position** (`laneIndexOf`,
  we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:222; `laneDirsForItem`,
  we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:339-347). It never calls `acquire` —
  zero call sites.
- Each lane agent's prompt step 1 runs the destructive prep by hand: `cd <lane> && git fetch … && git
  reset --hard origin/main … && git clean -fd …`
  (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:371-375).
- The per-lane key is already minted and deterministic: `laneKeyOf(it)` = `NNN` or `new-<slug>`
  (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:202-208), and `laneRefFor`
  namespaces the pushed ref by `<batchSlug>-<laneKey>`.
- Shell state does not persist across a lane agent's separate Bash calls (documented at
  we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:358-359) — an `export` cannot carry
  identity between steps.

## Empirical verification — no ambient per-lane signal exists

Re-verified live during this prep (2026-07-10, this session): a subagent spawned by this session printed
the **identical** `CLAUDE_CODE_SESSION_ID` as the parent, plus `CLAUDE_CODE_CHILD_SESSION=1` (a constant
flag, not an id). No other `CLAUDE*` env var is per-agent. This confirms the item's "Verified" section:

- A lane-agent `acquire` would stamp `ownerSession` = the shared orchestrator-session id ⇒ every sibling
  passes the owner test in **every** lane of the batch ⇒ the guard still cannot deny sibling-vs-sibling.
- Process ancestry over-matches by construction (all siblings share the orchestrator ancestor) — the
  exact fail-open r2 removed.
- Shell exports don't survive across Bash calls, so identity cannot be parked in the environment.

**Consequence:** the only per-operation channel that can distinguish siblings is the **command string
itself** — which only the guard reads. Any design that achieves sibling-level denial therefore requires a
(small) guard-side comparison extension. The item's original "a change to the lane-dispatch machinery,
not to the guard" holds only for the weaker cross-session-only scope; its own acceptance ("a destructive
git op run in a **sibling** parallel lane's clone is **denied**") is unreachable without touching the
guard. The prepared item reconciles this: the *stamp* lives in dispatch (Fork 1); whether the guard
learns a per-op assertion is the real merit fork (Fork 2).

## Prior art

1. **Fencing tokens (Kleppmann, "How to do distributed locking")** — a lock service alone can't stop a
   stale holder; the fix is a token issued at acquire time that the client must **present with every
   operation**, checked by the resource at the point of use. Redlock's flaw is precisely that no such
   token exists. Identity must ride the operation, not the ambient context.
   <https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html>
2. **Kubernetes `coordination.k8s.io` Lease / `holderIdentity`** — leader election CAS-writes a
   **self-minted identity string** (conventionally pod name + UID — unique per replica even when replicas
   are otherwise identical) into the Lease; the API server checks it at the point of write; renewal is
   periodic against `leaseDurationSeconds`. <https://kubernetes.io/docs/concepts/architecture/leases/>
3. **`git worktree lock`** — the negative case: a lock file with a free-text `--reason` and **no identity
   check on unlock**; any process can remove it. An advisory annotation without an enforced identity
   check is not a guard — which is why the #2367 hook exists on top of the lease file at all.
   <https://git-scm.com/docs/git-worktree>
4. **Pid-files / flock** — pid-based ownership fails across process trees (pid reuse, shared ancestry);
   robust practice ties liveness to a held `flock` fd, unique per literal process. The shared
   `CLAUDE_CODE_SESSION_ID` is this failure mode wearing an env var. <https://apenwarr.ca/log/20101213>
5. **GitHub Actions `concurrency` groups** — mutual exclusion keyed by an **author-composed string**
   naming the logical unit of exclusion (`${{ github.workflow }}-${{ github.ref }}`), never derived from
   the executing runner's ambient properties — the direct analogy to a minted per-lane slug.
   <https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency>
6. **GNU Make jobserver** — authorization travels **explicitly with each child invocation**
   (`--jobserver-auth=` fds/fifo passed on the command line of every sub-make; a token must be read
   before work starts), not through generic inherited environment.
   <https://www.gnu.org/software/make/manual/html_node/POSIX-Jobserver.html>

**Synthesis:** every mature system pushes identity to the finest distinguishable granularity — a minted
string per logical holder — and checks it **at the arbiter, at the moment of the operation**. None trust
an ambient inherited property (pid, parent env) once multiple holders can share it. For #2413 this maps
to: mint the per-lane identity in the dispatch (the author of the operation), put it on the lease, and
have the guard verify a per-op assertion of it in the command string.

## Standing test + classification

- **Stamp-or-not** is not a fork — "no stamp" is the broken branch (the guard has nothing to check;
  the item's whole point). What remains genuinely forks twice:
- **Fork 1 — where the stamp lives** (in-lane `acquire --lane=N` replacing step-1 prep, vs an
  orchestrator-side stamp at provision/coupling). Real either/or: exactly one mechanism must own the
  stamp (`O_EXCL` markers collide if both write; two owners = split-brain over release). Q1 layer:
  dispatch machinery. Q5 DI: `acquire` is already the injectable seam; a new provision-time verb
  duplicates coupling state.
- **Fork 2 — what the guard compares in the sibling-indistinguishable case** (session-level only,
  vs a per-lane assertion in the command string, fail-closed). Real either/or: the guard has exactly one
  posture for a marked lease — "ownerSession match suffices" and "ownerSession match does not suffice"
  cannot coexist. This is the merit fork the acceptance criteria hinge on.
- **Supported by default (dissolved, not forks):** release lifecycle (release at lane end; the shipped
  TTL/stale-reclaim already backstops crashes — we:scripts/lib/lane-lease.mjs:33-39); serial topology and
  degraded fail-open unchanged (acceptance #3 is a constraint on both forks, not a fork); the identity
  slug's exact spelling (`<batchSlug>-<laneKey>` — both halves already exist in the workflow).
- **Kind correction:** two genuine merit forks make #2413 a `kind: decision` mis-flagged as `story`
  (the mis-flag rule in we:docs/agent/backlog-workflow.md) — retyped during this prep.
