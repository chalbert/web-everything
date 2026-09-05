---
bornAs: xyrnzpf
kind: story
size: 2
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/"]
relatedTo: ["3472"]
dateOpened: "2026-09-04"
dateStarted: "2026-09-05"
dateResolved: "2026-09-05"
tags: [conveyor, dispatch, delivery]
---

# Nothing resolves which checkout's sidecar the live conveyor runner actually reads before `queue add` writes to it

`we:scripts/conveyor/queue.mjs add` always reports success, even when the `we:.conveyor/queue.json`
sidecar it just wrote is a checkout the live conveyor runner isn't reading from. The sidecar-per-checkout
design itself is correct and settled (decisions #2615/#2626 ratified it — not re-litigated here). The gap
is one layer up: no skill or declared operation resolves *which* checkout's sidecar the live
`we:skills-src/conveyor/runner.mjs` process is actually rooted in before a caller queues into one.

## The evidence — caught live, by hand, tonight (2026-09-04)

A session ran `node we:scripts/conveyor/queue.mjs add <N>` three times from the PRIMARY checkout
(`~/workspace/webeverything`), each time getting back a clean `✓ cleared` — believing it had queued
three items for the live conveyor. It hadn't:

- The actual running runner process, confirmed via `ps -p <pid> -o command=`, was
  `node we:skills-src/conveyor/runner.mjs --json`, pid resolved from the runner-singleton lock record
  under `~/.claude/conveyor-runner-locks/` (one lock dir per singleton lease, holding `owner`/`pid`/
  `heartbeatAt` — no `cwd` field).
- That lock record names a `pid`, not a working directory, so the only way to find out where the runner
  is actually rooted is `lsof -p <pid> | grep cwd` (or `ps -o command=` plus manual inference) — a
  by-hand step this incident needed and no tooling performs today. Doing it revealed the runner's real
  `cwd` was `~/workspace/wev-scratch-dispatcher-4`, a completely different, ad hoc scratch clone — not
  the primary checkout the session had been queuing from.
- That scratch clone carries its own separate `we:.conveyor/queue.json` (11 entries at the time), and
  none of the three newly-`add`ed items were in it — they landed in the primary checkout's own
  `we:.conveyor/queue.json` instead, a file the live runner never reads.
- `we:queue.mjs add` gave no signal of any of this. It resolves its target sidecar purely from the
  caller's own cwd (see `we:scripts/conveyor/queue-store.mjs`'s `resolveQueuePath`) and reports
  `✓ cleared` unconditionally — there is no cross-check against which checkout, if any, holds the live
  runner lock. The mismatch was only caught by manually cross-referencing the lock file's `pid` against
  `ps`, finding the runner's real `cwd` via `lsof`, and diffing the two `we:.conveyor/queue.json` files
  by hand.

**Compounding finding, same investigation (context, not this item's scope):** the scratch checkout was
also found 86 commits behind `origin/main` — the general staleness gap `#3472` already covers — so even
once queued into the *correct* sidecar, one of the three items had no backlog card at all in that stale
checkout and would have stayed invisible to dispatch regardless. Mentioned here only because it's what
made the mismatch actually costly, not as new scope; `#3472` (and `#3464`) own fixing checkout
staleness. This item's own scope is strictly the queue-target-resolution gap above.

## The fix (proposed shape — not built here)

A `queue-work` operation or skill that:

1. Reads the runner-singleton lock file(s) under `~/.claude/conveyor-runner-locks/` to find the live
   runner's `pid`, then derives its actual working directory — `lsof -p <pid> | grep cwd` is confirmed
   to work for this today; `we:scripts/lane-pool.mjs`'s own lock-reading code is worth checking first for
   an existing helper this can reuse rather than re-implementing pid→cwd resolution from scratch.
2. Refuses (or at minimum warns loudly, distinct from today's silent `✓`) when no live runner lock is
   found, or when multiple/stale lock dirs exist and the live one is ambiguous.
3. Writes into *that* resolved checkout's `we:.conveyor/queue.json` — via the existing
   `we:scripts/conveyor/queue-store.mjs` add/remove core, not a reimplementation — never wherever the
   caller happens to be `cd`'d.
4. Reports back which checkout it actually queued into, so a caller can never again walk away believing
   a `queue add` succeeded against a queue nobody is reading.

Whether this replaces `we:scripts/conveyor/queue.mjs`'s cwd-relative resolution outright or sits
alongside it as the preferred entry point is an implementation call for whoever builds this.

## Done when

1. **Executable** — a test exercises: (a) a live runner lock present, its `cwd` resolvable → the
   resolved checkout's `we:.conveyor/queue.json` gets the entry, not the caller's cwd's; (b) no live
   lock found → the command refuses or warns rather than silently succeeding; (c) multiple/stale lock
   dirs → the ambiguity is surfaced, not silently resolved to the wrong one.
2. Running the new path from a checkout that is *not* where the live runner is rooted must either queue
   into the runner's actual checkout or refuse — it must never again report success while writing to a
   sidecar nobody is reading, the exact failure mode this item documents.

## Progress

- **Status:** built, gate pending.
- **Done:** Added `we:scripts/conveyor/queue-work.mjs`, a new checkout-aware entry point alongside
  `we:scripts/conveyor/queue.mjs` (left untouched). It reads the runner's singleton lease
  (`we:skills-src/conveyor/runner-lock.mjs`) for the live runner's `pid`, resolves that `pid`'s real cwd
  via `lsof -a -p <pid> -d cwd -Fn` (the exact recipe the incident confirmed, already relied on in
  `we:scripts/pr-status.mjs`), and refuses rather than guesses when the lease is absent, stale (a crashed
  runner), ambiguous (more lock entries than the one singleton key expects), or the pid's cwd can't be
  resolved. On success it writes/reads the resolved checkout's `we:.conveyor/queue.json` via
  `we:scripts/conveyor/queue-store.mjs`'s existing pure core and reports back which checkout it targeted.
  `add`/`remove`/`list` all resolve the live checkout first — `list` too, since reading the wrong sidecar
  is just as misleading as writing one.
- **Tests:** `we:scripts/conveyor/__tests__/queue-work.test.mjs` — unit-covers absent/stale/ambiguous/
  cwd-unresolved via a real temp lock root with an injected pid-to-cwd function, plus one true end-to-end
  case that spawns a real dummy process rooted in a temp "checkout" and exercises the CLI's real `lsof`
  call, proving `add` writes into the resolved checkout and not the caller's own cwd.
