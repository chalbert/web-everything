---
kind: story
size: 8
parent: "1143"
status: resolved
blockedBy: []
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
tags: []
---

# Pre-lock reservation + lock layer for the clone orchestrator (the #1935/#1936 mandatory tier on top of the optimistic floor)

Build the mandatory pre-lock layer the #1933 clone orchestrator (slice 3, #1942) deliberately deferred. Slice 3 ships only the OPTIMISTIC git-merge floor (#1935 Option D) with post-hoc multiLaneFiles detection; this adds the pessimistic tier ratified by #1935 Fork 2 + #1936: before a lane edits a merge-risk file (the small residual set after #1938 shrinks it), it RESERVES that path via an atomic O_EXCL/lock-dir primitive under the central checkout (#1936 Fork 1a) with a heartbeat-TTL lease for stale-lock reclaim (#1936 Fork 2a); a second lane needing a held path waits or defers. Wire this into we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js so the central pre-claim/dispatch step assigns + enforces locks, preventing the wasted-lane and clean-but-wrong-structured-merge cases the optimistic floor only detects after the fact. Blocked by #1938 (shrink the monolith lock-set first).

## Progress
- **Status:** resolved
- **Branch:** main
- **Done:**
  - **Pure lock module `we:scripts/readiness/file-locks.mjs`** — the #1936-ratified policy as PURE, injected-clock logic (mirrors the `we:scripts/readiness/reservations.mjs` purity split): `reclaimDecision` (Fork-2 (a)+(b): heartbeat-TTL lease floor + same-machine PID-liveness *fast path*, PID layered never primary), `isLeaseExpired`, `wasReclaimed` (the broker fencing point), `planReservations`. Plus the thin ATOMIC fs primitives (the only impure surface): `acquireLockDir` (the `mkdir`/`O_EXCL` race gate — EEXIST for losers), `readLockEntry`, `heartbeat`, `releaseLockDir`, and `reserve` (acquire-or-reclaim in one call). One lock dir per path under `.claude/locks/<path-hash>/` (#1936 Fork-1a local home; never committed).
  - **CLI `we:scripts/readiness/file-locks-cli.mjs`** — the shell boundary lanes call: `reserve` / `heartbeat` / `release` / `fence` / `status`. Owns the fs root + clock + the same-machine PID-liveness probe (`kill(pid,0)` → `dead`/`alive`/`unknown`; only provably-`dead` accelerates, the PID-reuse guard). Exit 3 = BLOCKED (a live owner holds it → caller waits/defers) or lease-reclaimed (fence) → push rejected.
  - **Wired into `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`** — `RESERVED_MERGE_RISK` = the residual ③ static denylist after #1938 (~11 genuinely-monolithic shared WE files; per-entry registries incl. `adapters/<id>.json` + the 3 regen-on-merge derived artifacts are NEVER reserved); `reservedPathsFor(item)` maps a probe's `touchesMonolith` to lockable paths; `CENTRAL_LOCK_ROOT` = the one shared lock authority (`<primary>/.claude/locks`, lanes point `--root` at it, not their clone). The lane prompt gained step **1b RESERVE** (before editing a merge-risk path; exit 3 → carry, do not steal), a **heartbeat** keep-alive, step **3b FENCE** (the Kleppmann-race broker check before push), and step **5 RELEASE**.
  - **Unit proof `we:scripts/readiness/__tests__/file-locks.test.mjs`** — 26 tests, green: the pure decision matrix (free/own/pid-dead/lease-expired/held + fencing) AND the atomic fs primitives against a real temp lock root (mkdir-wins-once, block-on-live-held, reclaim-stale, PID-dead fast path, end-to-end fence-after-reclaim).
  - **Verified:** the 26-test suite green; the CLI smoke-tested end-to-end (acquire → block-on-held(exit 3) → fence-when-owned(exit 0) → release → re-acquire → fence-after-reclaim(exit 3)); the workflow module parses; scoped `check:standards --local --files=<my files>` = 0 errors (the full-gate reds are pre-existing untracked `we:blocks/*/contract.*` shadows + unrelated #1901, untouched by this item — correctly demoted to `note (external)` in the scoped run).
- **Next:** none — done.
- **Notes:** Cleared `blockedBy: ["1938"]` (satisfied — #1938 resolved: the monolith lock-set is shrunk, so this layer guards only the small irreducible residual). The lock logic's canonical home is the tested pure module; the workflow mirrors the contract inline (a workflow script has no fs read at runtime — same pattern as `RETURN_HYGIENE`). Since the concurrent set is already disjoint by construction (#1942), the lock layer's load-bearing role is the residual: it lets the orchestrator *enforce* (block/defer + broker-fence) rather than only *detect* (post-hoc `multiLaneFiles`) a merge-risk collision. `graduatedTo: none` — orchestrator tooling, not a new web-standard entity (lives in `we:scripts/readiness/` beside the advisory `we:scripts/readiness/reservations.mjs`, #6 WE-holds-zero-impl respected: this is batch infra, not a standard impl).
