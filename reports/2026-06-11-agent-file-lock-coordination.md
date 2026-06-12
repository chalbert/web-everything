# Agent file-lock coordination — prior-art survey

**Date**: 2026-06-11
**Point**: Multi-process / multi-agent coordination prior art for backlog #083's open forks (advisory vs hook-enforced, crash safety / TTL, deadlock avoidance, granularity, queue fairness), so the v1 JIT-lock design reuses established concurrency vocabulary instead of coining mechanics — and so the build-at-all question is settled against the cheaper rules the repo already runs.
**Backlog item**: `/backlog/083-agent-file-lock-coordination/`
---

## Question

When multiple agents work close features that *sometimes* touch the same files, and the file set isn't known upfront, #083 proposes a just-in-time, fine-grained lock: claim a file immediately before editing, hold for seconds, release after, backed by a per-file FIFO queue plus crash/deadlock safeties. Before authoring `lock.mjs` + a `PreToolUse`/`PostToolUse` hook, survey how operating systems, databases, and distributed systems have solved each sub-decision — and check the design against the coordination this repo *already* has.

The repo's current coordination is **not** file-level at all. It is **item-level** advisory claiming: `backlog.mjs claim <NNN>` flips frontmatter `status: open → active` via a guarded splice ([scripts/backlog/frontmatter.mjs:97-116](../scripts/backlog/frontmatter.mjs#L97-L116)), gated by the legal `from` status so the script "can't silently double-claim" ([frontmatter.mjs:102](../scripts/backlog/frontmatter.mjs#L102)), plus a dirty-working-tree concurrency *smell* check before claim ([scripts/backlog.mjs:80-82](../scripts/backlog.mjs#L80-L82), `isDirty` at [backlog.mjs:67-73](../scripts/backlog.mjs#L67-L73)). That is a coarse, advisory, whole-task claim. #083 asks whether we additionally need a fine-grained, enforced, *file*-level lock for the residual overlap that item-claiming doesn't cover.

## Key findings

### 1. Advisory vs mandatory is the OS's exact framing of fork 1 — and mandatory needs a kernel

Unix has run this fork for decades. **Advisory locks** (`flock(2)`, `fcntl()` default) work *only if all cooperating processes use the same mechanism and check it*; a process can ignore the lock and do the I/O anyway ([flock man page](https://man7.org/linux/man-pages/man2/flock.2.html), [Oracle System Interface Guide](https://docs.oracle.com/cd/E19455-01/806-4750/6jdqdflt4/index.html)). **Mandatory locks** are *kernel-enforced* — the kernel suspends any process that touches a locked region regardless of cooperation ([kernel.org mandatory-locking](https://www.kernel.org/doc/Documentation/filesystems/mandatory-locking.txt)). The decisive fact: mandatory enforcement requires a privileged layer that sits *below* the actors and intercepts every access. You cannot get mandatory semantics from a convention.

**Implication for fork 1:** "advisory (tell agents to check)" vs "enforced" maps exactly onto advisory-vs-mandatory. A pure-advisory `lock.mjs` that agents are *told* to call is the `flock` model — one undisciplined agent breaks the invariant, just as one non-cooperating process does. The only way to get *mandatory* semantics in an agent harness is the equivalent of the kernel: a **`PreToolUse` hook** that the harness runs before every `Edit`/`Write` and that can *deny* the tool call. The hook is our kernel. So enforced is not "advisory but stricter" — it is a categorically different (and the only real) lock.

### 2. Crash safety = leases with TTL; this is the universal answer (fork 2)

Every distributed-lock system answers "what if the holder dies?" the same way: the lock is a **lease** with a **TTL**, auto-expiring unless refreshed. etcd locks are tied to a **lease ID** that must be kept alive; Redis Redlock sets an expiry; Consul/ZooKeeper use session/ephemeral-node liveness ([Kleppmann, *How to do distributed locking*](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html), [Redlock](https://redis.antirez.com/fundamental/redlock.html), [etcd why](https://etcd.io/docs/v3.5/learning/why/)). A dead holder's lock simply expires and the resource frees.

**The sharp edge research surfaced — fencing tokens.** Kleppmann's well-known critique is that TTL alone is *unsafe*: a holder can pause (GC, suspend) past its TTL, the lock expires and is granted to someone else, then the paused holder wakes and writes — two writers. The fix is a **fencing token**: a monotonically increasing number issued with each grant; the protected resource rejects any write carrying a stale token ([Kleppmann](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)). Redlock lacks incremental fencing and is therefore "not for correctness."

**Implication for fork 2:** TTL + heartbeat is right and standard. But the honest version notes that *for this repo's scale*, full fencing is over-engineering — an expired-then-stolen lock followed by the original agent's late write is the failure mode, and our cheap mitigation is the same one the batch already uses: **git is the ground-truth conflict detector** (a stale late write becomes a visible merge conflict, [SKILL.md:143](../.claude/skills/batch-backlog-items/SKILL.md#L143)), not silent corruption. We adopt TTL + heartbeat and **log every steal**; we cite fencing as the principled escalation if a real two-writer corruption is ever observed, not a v1 requirement.

### 3. Deadlock: no-hold-while-blocked is exactly "deny the hold-and-wait condition" (fork 3)

Classic deadlock theory needs all four Coffman conditions; breaking any one prevents deadlock. The two textbook strategies are **lock-ordering / two-phase locking** (acquire *all* locks up front in a global order, breaking circular-wait) and the **wait-die / wound-wait** schemes (timestamp-ordered preemption) ([cs186 Transactions notes](https://cs186berkeley.net/notes/note12/), [Wait-Die / Wound-Wait](https://dspmuranchi.ac.in/pdf/Blog/Deadlock_prevention.pdf)). 2PL *requires knowing the full lock set in advance* — which #083's premise explicitly denies (file set discovered lazily).

**Implication for fork 3:** since the lock set is unknowable upfront, lock-ordering / all-or-none acquisition is infeasible. The remaining lever is to break **hold-and-wait** directly: **release everything you hold and requeue when you block** (no-hold-while-blocked). This is a recognized, principled deadlock-prevention discipline, not an ad-hoc rule — it makes circular wait impossible by construction. Wait-die/wound-wait is the alternative (let agents wait but timestamp-order who aborts); rejected because it forces rollbacks of partially-done edits and assumes a coherent global timestamp across independent sessions we don't have.

### 4. Granularity: coarser is safer; hot append-only files want single-writer, not finer locks (fork 4)

`flock()` is whole-file; `fcntl()` adds byte-range locks for databases that need different processes on different pages of one file ([Baeldung, file locking](https://www.baeldung.com/linux/file-locking), [loonytek](https://loonytek.com/2015/01/15/advisory-file-locking-differences-between-posix-and-bsd-locks/)). The lesson from "releasing locks early" / hotspot research is the inverse of "lock finer": for a *contention hotspot* the win comes from **not routing it through the general lock at all** — serialize it specially ([Releasing Locks As Early As You Can, arXiv:2103.09906](https://arxiv.org/pdf/2103.09906)).

**Implication for fork 4:** file-level is the right grain for normal per-entry `*.json`/`*.njk` files (contention rare and short). The hottest shared files — `semantics.json`, generated inventories — are append-from-everyone; a single file lock there would serialize *all* agents and a sub-file/section lock is brittle (no stable byte ranges in a hand-edited JSON). The grounded answer matches the repo's existing memory note (*intents.json Mixed-Escaping Footgun*: splice only changed entries): keep hot files **single-writer by policy** (one merge agent), outside the lock mechanism. Don't attempt mechanical sub-file locking.

### 5. Queue fairness: FIFO is standard; the real risk is a wedged waiter (fork 5)

etcd's lock orders waiters by a globally unique, monotonically increasing **Revision**, giving fair FIFO acquisition ([etcd why](https://etcd.io/docs/v3.5/learning/why/)). The known failure is not unfairness but a **stalled waiter** holding its queue slot forever (the head never proceeds, or a dead waiter wedges the line).

**Implication for fork 5:** FIFO by enqueue time, plus a **TTL on queued waiters too** so a stalled/dead waiter ages out and the line advances. This is the queue analogue of the lease TTL on holders — same crash-safety principle applied to the wait queue.

### 6. The build-at-all question: the repo already chose the cheaper route, deliberately

The 2025–2026 multi-agent-coding consensus is **git worktrees + isolated working dirs** so parallel agents never share a tree, converting "silent runtime file corruption into visible merge-time conflicts" ([Augment Code](https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution), [MindStudio worktrees](https://www.mindstudio.ai/blog/git-worktrees-parallel-ai-coding-agents)). Claude Code's own pattern is "**status flags that lock work claims** + git worktrees that isolate edits + dependency markers that sequence" ([MindStudio shared task list](https://www.mindstudio.ai/blog/claude-code-agent-teams-shared-task-list)) — i.e. *exactly* this repo's item-level `status: active` claim + the batch skill's worktree lanes, not a file lock. CodeCRDT notes lock-based coordination introduces O(N×L) contention and argues observation-driven coordination (re-read shared state) often beats locking ([arXiv:2510.18893](https://arxiv.org/pdf/2510.18893)).

This is precisely what [`/batch --parallel`](../.claude/skills/batch-backlog-items/SKILL.md#L123) already implements: **partition on provable file-disjointness into isolated worktree lanes, merge one at a time, and a merge conflict is the proof the partition was wrong → replay serially** ([SKILL.md:136-143](../.claude/skills/batch-backlog-items/SKILL.md#L136-L143)). The batch deliberately took the *static-partition* route over a JIT lock because its safety model is reliability-first.

**Implication for the meta-fork:** the JIT lock earns its keep *only* for the residual the static partition can't sidestep — **coincidental same-file overlap between fully independent agent sessions** whose file sets weren't declared and that aren't running under one `/batch`. Industry has largely routed around file locks with worktree isolation + item-claims + re-read-on-each-step. So the grounded recommendation is **keep #083 open / parked**: build the v1 lock only once a real residual collision is observed in practice that worktree-partition + item-claim + single-writer-hot-files didn't catch. Until then it is speculative machinery.

## Recommendation (to ratify in #083)

1. **Fork 1 — enforced via `PreToolUse` hook** (the harness is our "kernel"; advisory is the `flock` model that one bad actor breaks).
2. **Fork 2 — lease + TTL + heartbeat**, log every steal; git is the ground-truth backstop; fencing tokens cited as the principled escalation, not v1.
3. **Fork 3 — no-hold-while-blocked** (the only feasible Coffman-breaker when the lock set is unknowable upfront; 2PL needs it known, wait-die forces rollbacks).
4. **Fork 4 — file-level grain for per-entry files; hot shared files stay single-writer by policy**, outside the lock; no mechanical sub-file locking.
5. **Fork 5 — FIFO by enqueue time + TTL on queued waiters** so a stalled waiter ages out.
6. **Meta — keep open / parked**: ship the v1 `lock.mjs` + hook only when a real residual same-file collision survives worktree-partition + item-claim + single-writer. The cheaper rules cover most of the value (the item's own *Honest scope note*).

## Files Created/Modified

| File | Action |
| --- | --- |
| `reports/2026-06-11-agent-file-lock-coordination.md` | Created (this report) |
| `src/_includes/research-descriptions/agent-file-lock-coordination.njk` | Created (research-topic description) |
| `backlog/083-agent-file-lock-coordination.md` | Restructured into prepared-fork shape |
