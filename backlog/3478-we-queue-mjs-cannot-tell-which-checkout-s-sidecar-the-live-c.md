---
bornAs: xyrnzpf
kind: story
size: 2
parent: "3383"
status: active
scope: ["we:scripts/conveyor/"]
relatedTo: ["3472"]
dateOpened: "2026-09-04"
dateStarted: "2026-09-05"
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

- Built `we:scripts/conveyor/resolve-runner-checkout.mjs`: reads every lock dir under the runner-singleton
  lock root, classifies liveness (`no-live-lock` / `ambiguous` / `resolved`), and derives the live lease's
  pid to cwd via `lsof -a -p <pid> -d cwd -Fn` — the same flags `we:scripts/pr-status.mjs`'s `listLanes`
  already shells for lane-owner detection, reused rather than re-derived.
- Built `we:scripts/conveyor/queue-work.mjs`: the runner-aware sibling of `we:scripts/conveyor/queue.mjs` —
  resolves the live runner's checkout first, writes into that checkout's `we:.conveyor/queue.json` via the
  existing `we:scripts/conveyor/queue-store.mjs` core, and refuses (non-zero exit, no write) on
  `no-live-lock` / `ambiguous` / `no-pid` / `cwd-unresolved` / `process-mismatch` rather than guessing.
  `we:scripts/conveyor/queue.mjs`
  is unchanged and remains the cwd-relative entry point for a caller already in the runner's own checkout.
- Added `CONVEYOR_RUNNER_LOCK_ROOT` env override (parallels `CONVEYOR_QUEUE_FILE`) for test/ops use.
- Tests: `we:scripts/conveyor/__tests__/resolve-runner-checkout.test.mjs` (pure classifier + lsof-transcript
  parsing + end-to-end verdicts against a real temp lock root) and
  `we:scripts/conveyor/__tests__/queue-work.test.mjs` (CLI-level, a fake `lsof` shim on `PATH`, asserts the
  sidecar lands in the resolved runner checkout and never in the caller's own cwd).
- Noted the new entry point in `we:skills-src/conveyor/SKILL.md` for an operator unsure which checkout's
  runner is live.
- `/converge` round 1 (cosmetic): a recorded pid of exactly 0 is now `no-pid` rather than the less accurate
  `cwd-unresolved`; added CLI-level tests for the `no-pid`/`cwd-unresolved` refusal paths and a test that
  exercises the REAL default `lsof` shell-out (a fake binary on `PATH`, no `execFn` override) rather than
  only the injected-seam path.
- **Pid-reuse identity check (`verifyRunnerProcess`/`looksLikeRunnerProcess`).** Correctness and security
  independently flagged, across every review round, that heartbeat freshness alone doesn't prove a resolved
  pid still belongs to the runner (a crashed runner's pid can be reused by an unrelated process inside the
  same lease window). Two earlier attempts were each rejected and reverted: a bare substring match on the
  process command line (spoofable by an unrelated process whose argv merely contains the runner's script-path
  text) and a fixed-argv-position check (fragile against an interpreter flag ahead of the script path, or a
  path containing whitespace). The shipped version scans every whitespace-split token of the command line for
  an EXACT match against the runner's script-path suffix — concedes neither failure mode, since it needs
  neither a specific token position nor a raw substring anywhere in the line. `resolveRunnerCheckout` now
  refuses as `process-mismatch` (via `ps -o command=`) when a resolved pid's process no longer looks like the
  runner, before trusting its cwd.
- Final review pass: softened the docstring to say the identity check closes an accidental pid-reuse case, not
  a deliberate local-filesystem-spoofing threat model this item was never scoped to (claim-accuracy); added the
  one missing test exercising a `resolved` classification through the REAL default `leaseMinutes` rather than
  only the explicit-override paths (standards-conformance); and documented, explicitly, the accepted residual
  that `lsof`+`ps` are two non-atomic shell-outs, so no sequence of best-effort shell commands can make this
  fully transactional — a correct closure of that would be a bigger change than this item's scope.
