---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-13"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-11"
relatedReport: reports/2026-06-11-agent-file-lock-coordination.md
tags: [agent-coordination, file-locking, multi-agent, hooks, dev-workflow, concurrency]
crossRef: { url: /backlog/, label: Backlog }
---

# Agent file-lock coordination — JIT temporary ownership with queue + safeties

> **Reclassified `idea` → `decision` (2026-06-10, batch claim-time pre-flight).** Not an unprompted
> build: the *meta-fork* + *Honest scope note* leave open whether to build this at all — the `/batch`
> parallel-lanes design deliberately took the cheaper static-partition route *instead of* this JIT lock.
> The v1 (`lock.mjs` + hook) is only worth building once that "is the residual overlap case real enough"
> call is made. Surface-and-discuss (Tier B), don't auto-build.

When multiple agents work on **close features that sometimes touch the same files**, and you **don't
know upfront which files an agent will edit**, we want agents to **negotiate temporary ownership of a
file just-in-time** — a short-held lease acquired before an edit and released after — backed by a
**queue** for contention and **safety mechanisms** against crashes and deadlock. This is the
unpredictable-overlap residual the cheaper rules (partition by Project, single-writer on hot files)
don't cover. The six forks below are grounded in a prior-art survey published as the
[Agent file-lock coordination](/research/agent-file-lock-coordination/) research topic, each naming a
recommended default in **bold**.

The repo's coordination today is **not file-level** at all — it is **item-level advisory claiming**:
`backlog.mjs claim <NNN>` flips frontmatter `status: open → active` via a guarded splice
([scripts/backlog/frontmatter.mjs:97-116](../scripts/backlog/frontmatter.mjs#L97-L116)), gated by the
legal `from` status so it "can't silently double-claim" ([frontmatter.mjs:102](../scripts/backlog/frontmatter.mjs#L102)),
plus a dirty-working-tree concurrency *smell* check before claim ([scripts/backlog.mjs:80-82](../scripts/backlog.mjs#L80-L82),
`isDirty` at [backlog.mjs:67-73](../scripts/backlog.mjs#L67-L73)). The `/batch --parallel` skill adds the
*other* established route — **partition on provable file-disjointness into isolated git worktree lanes,
merge one at a time, a merge conflict is the proof the partition was wrong → replay serially**
([.claude/skills/batch-backlog-items/SKILL.md:136-143](../.claude/skills/batch-backlog-items/SKILL.md#L136-L143)).
These forks decide whether — and how — to add a fine-grained, enforced *file*-level JIT lock for the
residual that neither item-claiming nor static worktree-partition covers.

> **Observed false-positive in today's `isDirty` smell-check (2026-06-12, a batch session).** The
> pre-claim guard ([scripts/backlog.mjs:80-82](../scripts/backlog.mjs#L80-L82)) calls `isDirty` =
> `git status --short` truthiness, which treats an **untracked (`??`) file** as "another session may be
> on it." In this repo the backlog is **globally uncommitted** (hundreds of `M`/`??` entries are the
> author's normal WIP), so a freshly-scaffolded item is `??` from birth and `claim` **refuses every
> brand-new item** — a guaranteed false stop, not a real concurrency signal. The batch had to hand-apply
> each `open → active` transition. A racing agent that *dirtied a file mid-flip* would show `M`, not
> `??`; an untracked-from-birth file cannot have been "dirtied mid-flip." **Cheap fix, independent of the
> JIT-lock decision:** narrow `isDirty` to staged/modified states (ignore `??`), or add a `--force`
> escape. This is concrete evidence the current naive guard mis-fires — worth folding into whichever fork
> governs the claim-time concurrency check.

## Core model

Ownership is discovered lazily, so the lock (if built) must be **just-in-time and fine-grained**: claim
a file immediately before editing, hold for seconds, release immediately after — **not** "own this file
for my whole task." A shared on-disk `.locks/` registry (one lockfile per path, atomic create via
`mkdir`/`O_EXCL`) holds `{agentId, intent, acquiredAt, ttl}`. Acquire → edit → release; contention
appends to a per-file FIFO queue; release wakes the head. Plain filesystem state means it works across
fully independent agent sessions with no shared runtime.

### Recommended path at a glance

Ratify all six rows, or override just the one you'd change. The **confidence** column says where
judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · enforcement** | hook-enforced (`PreToolUse` denies/auto-acquires) | advisory (agents told to check) *(rejected)* | **High** — advisory = `flock`, one bad actor breaks it |
| **2 · crash safety** | lease + TTL + heartbeat, log steals | hold-forever / manual reaping *(rejected)* | **High** — universal distributed-lock answer; fencing is the escalation |
| **3 · deadlock** | no-hold-while-blocked (release + requeue) | lock-ordering / 2PL · wait-die *(rejected)* | **High** — lock set unknowable ⇒ only Coffman-breaker left |
| **4 · granularity** | file-level for per-entry; hot files single-writer by policy | mechanical sub-file/section locks *(rejected)* | **High** — sub-file locking brittle on hand-edited JSON |
| **5 · queue fairness** | FIFO by enqueue + TTL on queued waiters | unbounded FIFO *(rejected)* | **Med-high** — TTL stops a stalled waiter wedging the line |
| **6 · build at all?** | keep parked; build v1 only on observed residual collision | build v1 now | **Med** — cheaper rules cover most value; your call |

## Fork 1 — enforcement: advisory vs hook-enforced

This is the OS's advisory-vs-mandatory fork verbatim. Advisory locks (`flock(2)`, `fcntl()` default)
work *only if every cooperating process checks them* — a process can ignore the lock and write anyway.
Mandatory locks are *kernel-enforced*: a privileged layer below the actors intercepts every access. You
cannot get mandatory semantics from a convention. In an agent harness the only "kernel" available is a
`PreToolUse` hook the harness runs before every `Edit`/`Write`.

- **(A — recommended) Hook-enforced.** A `PreToolUse` hook on `Edit`/`Write` intercepts every edit,
  looks up the lock, and **denies with feedback** ("`X` held by agent-3, you're queued at position 2")
  or auto-acquires; `PostToolUse` releases. The harness enforces it, not the agent's goodwill — the only
  version that is actually a lock rather than a convention.
- **(B) Advisory.** Agents are *told* to call `lock.mjs` and check. Simpler, no hook plumbing; but it is
  the `flock` model — one undisciplined agent breaks the invariant for everyone. *Rejected*: an advisory
  "lock" the harness doesn't enforce is a convention, and we already have the item-level claim convention.

## Fork 2 — crash safety: TTL lease vs hold-forever

Every distributed-lock system (etcd lease IDs, Redlock expiry, Consul/ZooKeeper session liveness)
answers "what if the holder dies?" with a **lease that auto-expires unless refreshed**. The sharp edge
research surfaced: TTL *alone* is unsafe — a holder can pause past its TTL, the lock is re-granted, then
the paused holder wakes and writes (two writers). The principled fix is a **fencing token** (a monotonic
number the resource checks). Redlock lacks one and is therefore "not for correctness" (Kleppmann).

- **(A — recommended) TTL + heartbeat, log every steal.** A lease expires after N seconds unless
  refreshed; an expired lock is treated as free and the steal is logged. A dead agent never holds a lock
  forever. For this repo's scale full fencing is over-engineering — the cheap backstop is the one the
  batch already uses: **git is the ground-truth conflict detector** ([SKILL.md:143](../.claude/skills/batch-backlog-items/SKILL.md#L143)),
  so a stale late write surfaces as a *visible merge conflict*, not silent corruption.
- **(B) Hold-forever / manual reaping.** No TTL; a human/merge agent reaps stale locks. *Rejected*: a
  crashed agent wedges the file indefinitely — the exact failure leases exist to prevent.
- *Rejected (for v1):* full **fencing tokens**. Correct, but over-engineering at this scale; cited as the
  principled escalation *if* a real two-writer corruption is ever observed.

## Fork 3 — deadlock avoidance

Breaking any one Coffman condition prevents deadlock. The textbook strategies — lock-ordering / 2PL
(acquire all locks up front in a global order) and wait-die / wound-wait (timestamp-ordered preemption)
— both assume something this item's premise denies: **the full lock set is unknowable upfront** (the
file set is discovered lazily). So the only feasible lever is to break **hold-and-wait** directly.

- **(A — recommended) No-hold-while-blocked.** Release everything you hold and requeue when you block. A
  recognized prevention discipline (denies hold-and-wait by construction), not an ad-hoc rule; makes
  circular wait impossible.
- **(B) Lock-ordering / 2PL, or wait-die.** *Rejected*: 2PL needs the full file set known in advance
  (we don't have it); wait-die forces rollbacks of partially-done edits and assumes a coherent global
  timestamp across fully independent sessions we lack.

## Fork 4 — granularity

`flock()` is whole-file; `fcntl()` adds byte-range locks for databases that page one file across
processes. But the hotspot lesson is the inverse of "lock finer": for a contention hotspot the win is to
*not route it through the general lock at all* and serialize it specially.

- **(A — recommended) File-level for per-entry files; hot files single-writer by policy.** File-level
  locks fit normal per-entry `*.json`/`*.njk` files where contention is rare and short. The hottest
  shared files (`semantics.json`, generated inventory) are append-from-everyone — one file lock there
  serializes *all* agents. Keep those **single-writer by policy** (one merge agent), outside the lock
  mechanism, matching the repo's splice-only-changed-entries discipline.
- **(B) Mechanical sub-file / section locking.** Lock byte ranges or JSON sub-trees so multiple agents
  append concurrently. *Rejected*: brittle — no stable byte ranges in hand-edited JSON; the merge cost
  exceeds the single-writer policy's.

## Fork 5 — queue fairness

etcd orders waiters by a globally unique, monotonically increasing Revision (fair FIFO). The known
failure is not unfairness but a **stalled waiter** holding its slot forever and wedging the line.

- **(A — recommended) FIFO by enqueue time + TTL on queued waiters.** A stalled or dead waiter ages out
  of the queue and the line advances — the queue analogue of the holder's lease TTL.
- **(B) Unbounded FIFO.** Strict order, no waiter timeout. *Rejected*: a stalled head waiter wedges every
  agent behind it — reintroduces the crash-hang that fork 2 closes on the holder side.

## Fork 6 — build it at all? (the meta-fork)

The 2025–2026 multi-agent-coding consensus routes *around* file locks: **git worktrees + isolated
working dirs** convert silent runtime corruption into visible merge-time conflicts; Claude Code's own
pattern is "status flags that lock work claims + worktrees + dependency markers" — i.e. exactly this
repo's item-level `status: active` claim + the batch skill's worktree lanes. CodeCRDT notes lock-based
coordination introduces O(N×L) contention and argues re-read-shared-state often beats locking. The
`/batch --parallel` static partition ([SKILL.md:136-143](../.claude/skills/batch-backlog-items/SKILL.md#L136-L143))
already covers the predictable-overlap case by construction.

- **(A — recommended) Keep parked; build the v1 lock only on an observed residual collision.** The JIT
  lock earns its keep *only* for coincidental same-file overlap between fully independent sessions not
  running under one `/batch` — a residual the static partition can't sidestep. Ship `lock.mjs` + the
  hook once such a collision is actually observed (and worktree-partition + item-claim + single-writer
  didn't catch it).
- **(B) Build v1 now.** Author the lock proactively. *Rejected*: most of the value is already covered by
  partition-by-Project + single-writer-hot-files + worktree lanes; building now is speculative machinery
  for a residual not yet observed (the item's own *Honest scope note*).

## Cross-session batch reservation — selection-tier soft hint (added 2026-06-12)

> **BUILT 2026-06-12.** Shipped as the advisory selection-tier hint — independent of the (still-parked)
> file-lock forks 1–6, which remain a separate build gated on observed same-file collisions. Files:
> [scripts/readiness/reservations.mjs](../scripts/readiness/reservations.mjs) (pure lib — TTL, foreign-hold
> detection, deprioritize-not-exclude, first-holder-wins),
> [scripts/backlog.mjs](../scripts/backlog.mjs) (`reserve`/`unreserve` verbs + clear-on-claim),
> [scripts/check-readiness.mjs](../scripts/check-readiness.mjs) (`--select --session=<slug>` applies the
> penalty after the deterministic ranking), tests in
> [scripts/__tests__/reservations.test.mjs](../scripts/__tests__/reservations.test.mjs), registry at
> `.claude/skills/batch-backlog-items/reservations.json`, and the batch method in
> [docs/agent/backlog-workflow.md](../docs/agent/backlog-workflow.md) → *Cross-session reservation*. The
> penalty deliberately lives at the CLI boundary, NOT inside the byte-deterministic `computeSelection`
> core (reservations are time- + session-dependent), mirroring the #250/#252 quarantine discipline.

> **BUILT 2026-06-13 — legible-stop follow-on.** Complements the reservation hint: it makes a *drained*
> pool legible so a second batch's "no eligible Tier-A left" stop reads as "a concurrent session
> `claim`ed the open work, re-run shortly," not "backlog empty." `computeSelection` now derives an
> **in-flight** set — `status: active` items that are batch-shaped (task or story·≤8), i.e. the items
> that would be in the pool were they still open — exposed as `counts.inFlight` + `selection.inFlight`
> ([scripts/readiness/engine.mjs](../scripts/readiness/engine.mjs)). `--select` surfaces it: an
> `· N in flight` header tally, an explanatory line, an "In flight" listing (shown only when non-empty,
> so single-session runs are unchanged), and a drained-not-empty note on the empty-pack message
> ([scripts/check-readiness.mjs](../scripts/check-readiness.mjs)); test in
> [scripts/readiness/__tests__/engine.test.mjs](../scripts/readiness/__tests__/engine.test.mjs). Unlike
> the reservation penalty, in-flight is **byte-deterministic** (a pure function of on-disk `status`), so
> it lives **in** the `computeSelection` core, not at the CLI boundary. Staleness-free by construction
> (derived live from `status: active`, never a persisted record) — the deliberate non-fix is any blocking
> wait or hard lock, which would reintroduce the crash-staleness the (still-parked) forks 1–6 manage.

A distinct, *cheaper* layer that sits **above** the file lock and even above item-claim: it operates on
**which items a batch picks**, not on file edits. The residual it targets is wasteful, not corrupting —
two independent `/batch` sessions both run `check:readiness --select`, get the same ranked smallest-first
pack, **plan and start the same items**, and only diverge when one *wins* the late `claim`. The seam
re-read + claim guards already keep this *correct* (the loser drops the now-`active`/dirty item), but the
loser still burned the up-front analysis and any initial work before the seam caught it. The fix is to
make the overlap visible at **plan time** without giving up late claiming.

Keep the two states `claim` currently conflates **split**:

- **Hard claim** (`open → active`) stays late, at work-start — preserves the blocker-DAG + digest
  re-eval that happens the instant work begins (the reason claim-as-you-go beats claim-all).
- **Soft reservation** is stamped at **plan-approval** — a lightweight marker on each packed item, **not**
  a status flip. `check:readiness --select` then treats a live reservation as a **ranking penalty
  (deprioritize), not a hard exclude** — so a second batch naturally packs *around* the first's items, but
  a small pool isn't starved: if reserved items are all that's left, they still surface (penalized), and
  the late claim remains the real lock.

Three safeties are non-negotiable (the failure modes of any soft reservation):

1. **Deprioritize, don't exclude.** The reservation is a selection *hint*, never a lock. The `status`
   flip at `claim` is still the only thing that actually prevents double-work; the reservation just steers
   the *second planner* elsewhere first.
2. **Release on abandon.** If a batch stops/hands off without working a reserved item (stop rule fired,
   context seam, carry-forward), it **clears its own reservations** so the items flow straight back to
   full priority — the batch stop path and `/close` must drop the session's outstanding reservations, the
   same way `release` reverses a premature claim.
3. **Ignore stale reservations.** Each reservation carries a session id + timestamp and a **TTL**; an
   expired reservation is treated as absent (no penalty), so a *crashed* session can never depress an
   item's priority forever. This is the selection-tier analogue of fork 2's holder lease and fork 5's
   queued-waiter TTL — same crash-safety discipline, applied to the pick rather than the edit.

This is strictly **advisory** by design — and unlike fork 1, advisory is the *right* call here: the cost
of ignoring the hint is only redundant analysis (self-correcting at the seam), never corruption, so it
needs no `PreToolUse` enforcement. It complements the `/batch --parallel` *intra*-session partition
([SKILL.md:148-181](../.claude/skills/batch-backlog-items/SKILL.md#L148-L181)): partition handles items
**within one session**; this handles items **across independent sessions** that never share a partition.
Cheapest stopgap if this isn't built: deterministic **stride partitioning** (each session takes a disjoint
slice of the ranked list, e.g. by `NNN` parity, or seed each via `/batch-next <NNN-slug>`) — zero new
state, but only works when sessions agree and the pool is big enough to halve.

## Related — propagation (separate but adjacent)

Locking prevents collisions; it does not handle an in-flight agent **picking up what another just
shipped**. That is a **pull-not-push** concern: agents re-read source-of-truth (`semantics.json`, the
relevant `*.json`) and sibling `backlog/*.md` status notes at the **start of each step**, plus
`git rebase` at step boundaries on branch-based work. Worth codifying alongside, but distinct from the
lock mechanism.

## Proposed v1 (when picked up)

A tiny `lock.mjs` (acquire/release/queue against `.locks/`) + a `PreToolUse`/`PostToolUse` hook in
`settings.json` that calls it, validated on two parallel agents reaching for the same per-entry file.
Anything heavier (central broker, sub-file locks, full fencing) is over-engineering for this repo's
scale.

## Honest scope note

Most of the value here is already covered by partition-by-Project + single-writer-on-hot-files +
worktree lanes. This item earns its keep **only** for coincidental same-file overlaps between agents
whose file sets weren't known ahead of time. Keep it minimal — and per fork 6, parked until that
residual is observed in practice.

## Resolution (final) — Fork 6 ratified 2026-06-13

All six forks are now ruled. The five *mechanism* forks were ratified to their bold defaults on
2026-06-11 (high-confidence "how it works if built" rows, no further human judgment). The lone
*roadmap/scope* fork (build-at-all) was the only genuine human call, **ratified to A (keep parked)
on 2026-06-13**:

- **Fork 6 — A: keep the JIT lock parked; build `lock.mjs` + the hook only on an observed residual
  same-file collision.** Rationale: (1) the 2025–26 multi-agent consensus routes *around* file
  locks — git worktrees + status-flag claims turn silent corruption into visible merge conflicts,
  which is exactly this repo's `status: active` item-claim + the `/batch` worktree lanes; a
  `PreToolUse` lock on *every* edit is real per-edit overhead plus a new crash-staleness surface
  (forks 2/5 exist only to manage failure modes the lock itself introduces). (2) The residual is
  genuinely **unobserved** — the only concurrency evidence to date is the *opposite* problem (the
  `isDirty` guard mis-firing with false stops), not two-writer corruption. (3) A is not "do
  nothing": the mechanism design is settled and on the shelf, ready to ship the instant a real
  collision is seen. The cross-session **soft-reservation** layer (built 2026-06-12/13) already
  covers the cheaper cross-session *picks-overlap* residual that sits above the lock.
- **Spun off, independent of the lock decision:** the observed `isDirty` claim-time false-positive
  (untracked `??` files mis-read as a concurrency signal → every brand-new item refused) is carved
  to **#510** as a standalone cheap guard fix — not gated on the (parked) JIT-lock build.

The five mechanism forks, for the record:

- **Fork 1 — hook-enforced (`PreToolUse` denies/auto-acquires)**: only a harness-enforced hook is an actual lock; an advisory convention is the `flock` model where one undisciplined agent breaks the invariant.
- **Fork 2 — lease + TTL + heartbeat, log steals (git as backstop)**: the universal distributed-lock crash-safety answer; a stale late write surfaces as a visible merge conflict, with full fencing tokens held as the escalation only on observed two-writer corruption.
- **Fork 3 — no-hold-while-blocked (release + requeue)**: the lock set is unknowable upfront, so breaking hold-and-wait directly is the only feasible Coffman lever (2PL/wait-die both assume a known global set we lack).
- **Fork 4 — file-level for per-entry files; hot files single-writer by policy**: file-level fits rare/short per-entry contention; append-from-everyone hot files stay single-writer outside the lock, matching the splice-only discipline (sub-file locking is brittle on hand-edited JSON).
- **Fork 5 — FIFO by enqueue time + TTL on queued waiters**: fair ordering plus a waiter TTL so a stalled/dead waiter ages out instead of wedging the line (the queue-side analogue of the holder lease).

**Closed 2026-06-13 — Fork 6 ruled A (keep parked):** it was a roadmap/scope bet, not a mechanism question — most of the value is already covered by partition-by-Project + single-writer + worktree lanes (+ the soft-reservation hint), so the residual is not yet real enough to justify building `lock.mjs` + the hook now. The mechanism design above is the ready-to-ship spec for when an actual same-file collision is observed. See the *Resolution (final)* block for the full rationale; the `isDirty` guard fix is carved to #510.
