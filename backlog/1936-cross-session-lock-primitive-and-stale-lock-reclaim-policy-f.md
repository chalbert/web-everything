---
kind: decision
parent: "1933"
status: open
dateOpened: "2026-06-28"
preparedDate: "2026-06-28"
relatedReport: reports/2026-06-28-cross-session-lock-primitive.md
tags: []
---

# Cross-session lock primitive and stale-lock reclaim policy for reserved files

How #1933's central broker implements the mandatory per-file reservation lock and reclaims it when an owning session closes or hangs. This is the **stronger, write-enforced** sibling of the existing *advisory* soft-reservation hint (`we:scripts/readiness/reservations.mjs`, `we:.claude/skills/batch-backlog-items/reservations.json`, #083): that hint only deprioritizes item selection and self-corrects at a re-read seam, whereas this lock guards actual file edits in the central checkout and must block a conflicting write. Drives the lock slice of `/backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua/`.

Prior-art survey grounding both forks: research topic `2026-06-28-cross-session-lock-primitive` (lease+heartbeat across Chubby / ZooKeeper / etcd; `flock(2)` fd-lifetime limits; PID-reuse hazard; Redlock critique + fencing).

## Context (from #1933)

The central broker (the primary checkout, the only tree the human watches) is the sole integration + lock authority. Agents work in lane clones, refresh from main, RESERVE merge-risk files, edit, commit (keep local branch), push a temp branch to the central instance, which merges + gates + pushes main to origin, then frees the lane. Topology that constrains this decision: **single machine, single authority, separate short-lived agent invocations as clients** (an invocation does not keep a process/fd alive across reserve→edit→commit→push). That rules out consensus services (overkill for one machine) and `flock` (lifetime bound to an open fd in a live process).

## Forks

### Fork 1 — the lock primitive

What physically represents "this reserved path is held."

- **(a) Atomic lock directory / `O_EXCL` lockfile per reserved path** — one entry per path under the local central checkout (e.g. `we:.claude/locks/<path-hash>/`), holding `{ owner-session, heartbeat-at }` JSON. `mkdir` is atomic on POSIX and `O_EXCL` create is atomic on a local fs, so acquisition is race-free across separate processes with no daemon. Persists across the gaps between agent invocations. **← recommended default.**
- (b) OS advisory lock (`flock`) — kernel auto-releases on process exit (no stale-lock problem), but the lock lifetime is bound to a held-open file descriptor in a live process. #1933's clients are separate invocations with no long-lived anchor process, so there is nothing to hold the fd open across the reservation window; lock-conversion is also non-atomic per the man page. Solves a problem the broker doesn't have, misses the one it does.
- (c) Lock ENTRIES in a single central registry file — mirror the existing `we:.claude/skills/batch-backlog-items/reservations.json` shape (one JSON file, `held: [...]`, mutated by `we:scripts/backlog.mjs` reserve/unreserve via the pure `we:scripts/readiness/reservations.mjs`). Familiar and already-proven for the *advisory* tier, but a single shared file is itself a write-contention point under true-parallel lanes (concurrent read-modify-write races), and a committed registry would race on push exactly as #1933 rejected for `we:.claude/skills/batch-backlog-items/claims.json`. Acceptable for an advisory hint that self-corrects; not for a mandatory write-time lock.

**Recommended default: (a)** atomic lock directory / `O_EXCL` lockfile per path. *Grounding:* per-path lockfiles avoid the single-file write-contention point of (c); the local-only home sidesteps the `O_EXCL`-on-NFS unreliability the research flags; `flock`'s fd-lifetime model (b) doesn't fit cross-invocation clients. *Confidence: High.*

### Fork 2 — stale-lock reclaim policy

How a lock held by a closed/hung owner gets freed.

- **(a) Heartbeat-TTL lease** — the owner refreshes a heartbeat timestamp while alive; any session may reclaim a lock whose heartbeat is older than the threshold. This is the convergent pattern across Chubby (renewable leases), etcd (lease + keep-alive within TTL), and ZooKeeper (session heartbeat → ephemeral-node deletion on expiry), and it is the *exact shape* the repo's advisory reservation hint already uses (`ttlMinutes`, stale entries ignored + pruned on write). The correctness floor; works even if an owner were ever on a different host.
- (b) PID/process-liveness check — reclaim if the owner PID is provably gone (`process.kill(pid, 0)` / `kill -0`). Fast recovery from a clean crash, but **same-machine only** and unsafe alone: the kernel reuses PIDs, so a stale lock's PID often points at an unrelated live process (the robust recipe additionally checks the PID's command line).
- (c) Manual unlock only — rejected: the dominant real-world stale-lock failure (SIGKILL / crash / hung session leaving a lock nothing clears) would wedge the broker until a human intervenes, defeating an autonomous fleet.
- **(a)+(b) combined** — heartbeat-TTL lease as the correctness floor, with a same-machine PID-liveness *fast path* that reclaims a provably-dead owner immediately rather than waiting out the full TTL. **← recommended default.**

**Recommended default: (a)+(b) combined** — lease is the ceiling for hangs and the only host-independent mechanism; PID-liveness is the same-machine accelerator for clean crashes; manual-only (c) is rejected. *Grounding:* mirrors the existing reservation TTL precedent and the Chubby/etcd/ZooKeeper convergence; PID layered (not primary) because of the documented PID-reuse hazard. *Confidence: High.*

### Insurance against the lease-expiry race (not a fork — a recommended invariant)

Kleppmann's Redlock critique describes the live hazard for #1933: an owner pauses past TTL, gets reclaimed, then wakes and writes anyway. Rather than baking fencing tokens into the lock entry, **make the central broker the fencing point** — reject a push from a lane whose lease was reclaimed mid-flight. This fits #1933's "central instance is the sole integration authority" model and keeps the lock entry simple. Record the rationale on ratification.

## Recommended path

| Decision | Recommended default | Why (grounding) | Confidence |
| --- | --- | --- | --- |
| Fork 1 — primitive | (a) atomic lock dir / `O_EXCL` lockfile per path, `{owner-session, heartbeat-at}` JSON under the local central checkout | Race-free across separate invocations, daemon-free, no single-file contention point; local home avoids `O_EXCL`-on-NFS; `flock` fd-lifetime doesn't fit cross-invocation clients | High |
| Fork 2 — reclaim | (a)+(b): heartbeat-TTL lease + same-machine PID-liveness fast path | Lease = correctness floor (Chubby/etcd/ZK convergence; mirrors the advisory TTL precedent); PID layered for fast clean-crash recovery; manual-only wedges the fleet | High |
| Insurance | Broker rejects pushes from a lane whose lease was reclaimed (fencing at the integration point) | Closes the Kleppmann lease-expiry race without lock-entry fencing tokens; fits #1933's sole-authority model | Medium-High |

## Definition of ready

- Prior art surveyed and published (research topic `2026-06-28-cross-session-lock-primitive`).
- Both forks stated with options, a bold recommended default, grounding, and a confidence tag.
- `preparedDate` set; this is ready to **ratify** (pick the defaults or override with stated reasons), not cold-research, at the decision turn.
