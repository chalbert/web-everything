# Cross-Session Lock Primitive + Stale-Lock Reclaim: Prior-Art Survey

**Date:** 2026-06-28
**Scope:** The mandatory per-reserved-path lock that backlog #1936 must pick, plus the policy for reclaiming a lock when its owning agent session closes or hangs. Sibling to the existing *advisory* soft-reservation hint (`we:scripts/readiness/reservations.mjs`, backlog #083) — that hint only steers item selection and self-corrects at a re-read seam; this lock is the **stronger, write-time-enforced** version that guards actual file edits inside #1933's central broker.
**Method:** Targeted survey of well-known coordination systems and OS lock facilities (Chubby, ZooKeeper, etcd, Redis Redlock + its critique, `flock(2)`, lockfile / PID-file conventions). Primary sources: the original Chubby OSDI'06 paper, Apache ZooKeeper docs, etcd concurrency docs, the Linux `flock(2)` man page, Martin Kleppmann's Redlock critique. Claims below were read from those sources; no API names or version numbers are stated that were not seen in them.
**Goal:** Ground #1936's two forks — (1) the lock primitive, (2) the reclaim policy — in real systems, so the decision turn is fast ratification.

---

## Executive summary

**The lease-with-heartbeat pattern is the cross-industry default for "reclaim a lock whose owner went away," and it does not require a daemon to adopt at this scale.** Chubby, ZooKeeper, and etcd all converge on the same shape: an owner must periodically prove liveness (renew a lease / send a keep-alive / hold a session), and the authority reclaims the lock when that proof lapses past a TTL. The single biggest cited *failure mode* of the naive lockfile is the inverse — a stale lock left behind on an unclean exit (SIGKILL, crash, hung session) that nothing ever clears. So the reclaim policy, not the primitive, is the load-bearing design choice.

**For #1933's topology the primitive should be the cheapest thing that is atomic across separate processes: an atomic lock directory / `O_EXCL` lockfile per reserved path, holding owner-session + a heartbeat timestamp.** #1933's broker is a *single machine, single authority* (the central checkout) with *separate, short-lived agent invocations* as clients. That rules out the two ends of the spectrum: a consensus service (Chubby/ZooKeeper/etcd) is overkill for one machine, and `flock(2)` is awkward because its lock lifetime is bound to an *open file descriptor / process*, which agent invocations don't keep open across turns. An atomic-create lockfile is cross-process, daemon-free, and survives the gaps between invocations — exactly the niche here.

**PID-liveness reclaim is a useful same-machine accelerator but is unsafe alone because the kernel reuses PIDs.** The widely-cited idiom (`process.kill(pid, 0)` / `kill -0`) only answers "is *a* process with this id alive," and an old lock frequently ends up pointing at an *unrelated* reused PID. The robust pattern verifies the command line of the live PID before trusting it. So PID-liveness is best as a *fast-path* on top of a heartbeat-TTL lease — not the primary expiry mechanism.

---

## Findings

### 1. Lease + heartbeat is the convergent reclaim pattern

> **Across Chubby, ZooKeeper, and etcd, an owner proves liveness on a clock and the authority reclaims on lapse.** *[Confidence: High — primary docs]*

- **Chubby** (Google's coarse-grained lock service, OSDI'06, Mike Burrows) is explicitly designed for *coarse* locks held for minutes-to-hours, on the reasoning that this reduces load on the lock authority and makes clients *less susceptible to the authority's crashes*. Master leadership itself is held under a renewable *master lease*. The coarse-grained framing maps directly onto #1933, where a lane holds a file reservation for the duration of an edit, not microseconds.
- **etcd** grants a *lease* with a TTL; the lease expires unless the cluster receives a *keep-alive* within the TTL. Its lock API is built on this lease mechanism — the lock is held until explicitly unlocked *or the owner's lease expires*. A *session* is "a lease kept alive for the lifetime of a client," which fault-tolerant apps use to reason about liveness.
- **ZooKeeper** achieves the same via *ephemeral znodes*: a lock is a node tied to the client's session, and on session expiration the cluster *deletes all ephemeral nodes owned by that session*. The session is kept alive by client heartbeats; miss them past the session timeout and the cluster declares the client dead and frees its locks. "If the client dies or loses connection... ZooKeeper automatically deletes the associated ephemeral node. This prevents deadlocks."

**Implication for #1936:** the heartbeat-TTL lease is not exotic; it is the boring, correct default. The lock JSON should carry an owner-session id and a heartbeat timestamp, refreshed while the owner works; any session may reclaim a lock whose heartbeat is older than the threshold. This is the *exact same shape* the repo's advisory `we:.claude/skills/batch-backlog-items/reservations.json` already uses (a `ttlMinutes` lease, stale entries ignored/pruned) — the lock just makes it mandatory and write-enforced instead of a selection hint.

### 2. The naive lockfile's signature failure is the stale lock on unclean exit

> **A lock left behind by a crashed/SIGKILLed/hung owner that nothing ever clears is the dominant real-world bug — and the whole reason a reclaim policy is mandatory.** *[Confidence: High — corroborated by multiple bug reports]*

Public bug trackers repeatedly show the same pattern: a tool acquires a `*.lock` / session-lock file, the process dies uncleanly (SIGKILL, crash, hard reboot, container kill), and a *stale* lock blocks all future startups until a human deletes it. This is precisely the hazard #1933 calls out ("stale locks must be reclaimable if an owning session closes or hangs"). It confirms that **manual-unlock-only is not an acceptable standalone policy** for an autonomous agent fleet — a hung lane would wedge the broker until a human intervenes.

### 3. `flock(2)` auto-releases on process exit — its strength and its disqualifier here

> **`flock` ties lock lifetime to an open fd / the process; the lock releases when the last duplicated fd closes or the process exits.** *[Confidence: High — `flock(2)` man page]*

- **Upside:** automatic cleanup. The man page guarantees that while a lock is held the holding process is alive, and the kernel drops the lock on exit. No stale-lock problem.
- **Disqualifier for #1933:** that lifetime is bound to a *held-open file descriptor in a live process*. #1933's clients are *separate agent invocations* that do not keep a process (or fd) alive across the reserve→edit→commit→push window — there is no single long-lived process to anchor the `flock` to. Lock-conversion is also explicitly *not atomic* (the old lock is removed, then a new one taken, with a window in between). So `flock` solves a problem the broker doesn't have (in-process fd lifetime) and fails to solve the one it does (cross-invocation persistence).
- **Caveat for the chosen primitive:** the same sources note `O_EXCL` is unreliable on NFS, and the portable atomic-lockfile recipe is `link(2)` of a unique temp file (or an atomic `mkdir`). #1933's locks live under the *local* central checkout, not NFS, so atomic `mkdir` / `O_EXCL` is safe here — but the research flags NFS as the boundary condition if that ever changes.

### 4. PID-liveness is a same-machine accelerator, not a primary mechanism

> **`process.kill(pid, 0)` answers "does some process with this id exist," not "is *my* owner alive" — PID reuse makes it unsafe alone.** *[Confidence: High — convention + corroborated bug reports]*

The standard idiom (`process.kill(pid, 0)` in Node, `kill -0` in shell) is a no-op signal that throws if the pid is gone — the canonical liveness probe. But the kernel reuses PIDs aggressively, so a stale lock's recorded PID frequently points at an *unrelated* live process; the robust recipe additionally checks the *command line* of that PID (`ps -p <pid> -o command=`) before trusting "alive." It is also *single-host only* by construction — a lock recorded on machine A says nothing about a PID on machine B.

**Implication for #1936:** PID-liveness is valuable as a *fast reclaim path* — if the owner PID is provably gone, reclaim immediately rather than waiting out the full TTL — but it must sit *on top of* the heartbeat-TTL lease (which is the correctness floor and the only mechanism that works if the owner is ever on a different host). Combining them gives both quick recovery from clean crashes and a safe ceiling for hangs and PID reuse.

### 5. Redlock is a cautionary tale about over-engineering the primitive

> **Kleppmann's critique: a lock that relies on timing assumptions for *correctness* is "neither fish nor fowl" — too heavy for efficiency, too unsafe for correctness — and the real protection is a fencing token.** *[Confidence: High — Kleppmann's blog + Redis docs]*

Redis Redlock acquires a lock across N independent Redis nodes with a majority + TTL. Martin Kleppmann argued it is unsafe for correctness-critical use: a client can acquire a lock, pause (e.g. GC), have the lease expire unnoticed, and resume to mutate a resource another client now owns — violating mutual exclusion. His proposed protection is a **fencing token**: a monotonically increasing number issued with each lock grant, which the protected resource rejects if it ever sees a lower one. Redlock's random value is *not* monotonic, so it can't fence.

**Two implications for #1936:**
1. **Don't reach for a distributed-lock framework.** For a single-machine broker, the heavyweight multi-node machinery is unjustified — Kleppmann's own recommendation is to use a proper consensus system (ZooKeeper) *only* when you genuinely need correctness across nodes, which #1933 does not.
2. **A fencing-style guard is the cheap insurance against the lease-expiry race.** The exact hazard Kleppmann describes — owner pauses, lease expires, owner resumes and writes anyway — is live for #1933 (an agent could hang past TTL, get reclaimed, then wake and try to commit/push). The natural fence here is that the **central broker is the sole merge authority**: it can reject a lane's push whose recorded lease was reclaimed, even though the lane still "thinks" it holds the lock. This makes the broker the fencing point rather than baking tokens into the lockfile — a good fit for #1933's "central instance is the only integration authority" model.

---

## Bottom line for #1936

- **Primitive:** atomic lock directory / `O_EXCL` lockfile per reserved path, under the local central checkout, holding `{ owner-session, heartbeat-at }` JSON. Cross-process, daemon-free, persists across separate agent invocations — the niche `flock` and a single shared registry file both miss.
- **Reclaim:** heartbeat-TTL lease as the correctness floor (mirrors the repo's existing `we:.claude/skills/batch-backlog-items/reservations.json` TTL design), with a same-machine PID-liveness *fast path* for immediate reclaim of a provably-dead owner. Manual-unlock-only is rejected (the dominant stale-lock failure mode would wedge the fleet).
- **Insurance:** make the central broker the fencing point — reject a push from a lane whose lease was reclaimed mid-flight — rather than building fencing tokens into the lockfile.

## Sources

- [The Chubby lock service for loosely-coupled distributed systems (OSDI'06, Mike Burrows)](https://research.google.com/archive/chubby-osdi06.pdf)
- [Apache ZooKeeper Programmer's Guide — ephemeral nodes & sessions](https://zookeeper.apache.org/doc/current/zookeeperProgrammers.html)
- [Apache ZooKeeper Recipes and Solutions — locks & leader election](https://zookeeper.apache.org/doc/r3.1.2/recipes.html)
- [etcd — concurrency / lock API & lease keep-alive](https://etcd.io/docs/v3.4/learning/api/)
- [etcd concurrency package (Go) — Session / Mutex on top of leases](https://pkg.go.dev/go.etcd.io/etcd/client/v3/concurrency)
- [flock(2) — Linux manual page](https://man7.org/linux/man-pages/man2/flock.2.html)
- [Martin Kleppmann — How to do distributed locking (Redlock critique, fencing tokens)](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
- [The Redlock Algorithm — Redis (antirez)](https://redis.antirez.com/fundamental/redlock.html)
- [trbs/pid — pidfile with stale detection (PID-liveness convention)](https://github.com/trbs/pid)
