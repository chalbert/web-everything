---
bornAs: xoh0xzj
kind: story
size: 5
parent: "2677"
status: resolved
blockedBy: ["2699"]
scope: ["we:skills-src/conveyor/"]
dateOpened: "2026-07-27"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Per-lane runner: a headless runner driving the mechanical tick core for one lane

The DELEGATE half of #2677(b): a **headless runner** (under `we:skills-src/conveyor/`) that drives the mechanized tick core for ONE lane — **singleton-locked, no per-lane LLM** — so orchestration moves off the single serial main session out to the lanes. Ratified boundary #2701 (Option A, codified at [we:docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent](/docs/agent/platform-decisions/#conveyor-orchestration-mechanics-not-per-lane-agent)) settles this as **pure deterministic mechanics + a headless runner, NOT a per-lane conducting agent**: the runner reads state and steps the #2699 tick-core state machine, spends no model context per tick, and escalates genuine novelty up to the main-session judgment layer rather than improvising a ruling.

Build conditions from #2701: (1) durable guard state surviving a runner restart — delivered in #2699; (2) a **singleton lock** on the runner so two runners never double-dispatch the same lane/item (mirrors the drain daemon's sole-writer discipline) — the one net-new build condition.

Still BLOCKED only on #2699 (the mechanical core the runner drives must exist first); the #2701 boundary is now ratified, so the framing is settled.

## Scope note (kept dir-level — justified; #2619 finer-lease)

Kept at `we:skills-src/conveyor/` on purpose rather than forced to a speculative file list. The build creates NEW
files (the headless runner + its singleton-lock module + its test), and this item is still **blocked on #2699**, so
predicting their exact filenames now would be a guess — and a scope narrower than the real touch-set breaches at build
time. `we:skills-src/conveyor/` is already a small, focused dir (the conveyor skill briefs), and nothing but the
in-flight #2641 shares it, so this item is already scope-disjoint from the other queued items (#2665, #2707, #2684,
#2661) at the dir level — narrowing would buy no extra parallelism. The runner *drives* the #2699 tick-core
(`we:scripts/conveyor/tick-core.mjs`) by importing it read-only, so tick-core is deliberately NOT in scope (scope is
the write-set, not the import graph). Re-narrow to the concrete new filenames once #2699 lands and the runner's files
are known.

## Progress

Built the singleton-locked headless runner over the #2699 tick core (three new files under
`we:skills-src/conveyor/`, all in scope):

- **`we:skills-src/conveyor/runner-lock.mjs`** — the singleton lock (the one net-new build condition from
  #2701). A machine-global, TTL-leased sole-driver right mirrored from the drain daemon's whole-process lease
  (`we:scripts/readiness/drain-lock.mjs`), built on the shared atomic `O_EXCL` + TTL primitive
  (`we:scripts/readiness/file-locks.mjs`) — never a fork. A second runner launch NO-OPS on a live lease; a
  stale (crashed-runner) lease is reclaimed via the TTL; heartbeat/release fence on ownership. This enforces
  #2701's SINGLETON runner (no per-lane conductor, Option B rejected) so two runners never double-dispatch the
  same lane/item.
- **`we:skills-src/conveyor/runner.mjs`** — the headless, no-LLM runner: a pure-core / IO-shell split (mirrored
  from the tick core). The pure core (`runLoop`, `carryForward`, `shouldStop`, `tickSurface`) STEPS the
  tick-core state machine and threads its `nextState` forward UNCHANGED — the thin-shell invariant: it
  re-derives NO guard/TTL/watcher (the core owns all of it). It spends no model context per tick and SURFACES
  the tick's dispatch/watch decisions for the main-session judgment layer to execute (#2701 clause 3), rather
  than spawning LLM agents itself. The IO shell shells `we:scripts/conveyor/tick-core.mjs`, runs the
  deterministic no-LLM passes (infra-blocked recovery, lease-reaper, best-effort), heartbeats the singleton
  lease, and stops on the core's idle-stop / a `--once` budget / a lost lease.
- **`we:skills-src/conveyor/__tests__/runner.test.mjs`** — unit proof of both subjects (singleton no-op /
  stale-reclaim / fencing, and the loop's carry-forward / stop / surface / lease-loss control flow).
  `we:vitest.config.ts` gains one include glob so `skills-src/**/__tests__` tests are discovered by the `test`
  CI check (the only out-of-`scope` touch — a one-line test-discovery enabler, not a policy/gate-self path).

Deliberately NOT done (out of scope, later slices): retiring the main-session serial loop (#2703, blocked on
this) and wiring headless LLM agent-spawning via the CLI agent-runner backend (`#agent-runner-cli-backend`).
The existing build/prepare/fix/CI-heal guard semantics are PRESERVED verbatim — they live in the tick core; the
runner alters none of them.
