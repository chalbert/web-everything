---
kind: decision
parent: "4075"
status: open
scope: ["we:scripts/conveyor/flows/README.md", "we:scripts/conveyor/flows/flow-model.mjs", "we:scripts/conveyor/flows/check.mjs", "we:scripts/conveyor/flows/graph.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, workflow, flows, decision]
relatedTo: ["4120", "3931", "xr05jjl"]
---

# Workflow manager: flows as executable configuration

Target (operator, 2026-09-26): migrate ALL flow-like conveyor code to declared workflow configuration — every daemon, pass and dispatch lifecycle executes from a declared flow; only step logic (classifiers, gates, effects) stays in code the config calls. Open forks: the engine (declared operations + #4120 jobs vs an adopted engine like Temporal vs staying describe-only), the config-code boundary, and migration safety. Not ruled: /prepare first, then the operator rules.

## The target (operator intent, 2026-09-26)

**Migrate ALL flow-like conveyor code to declared workflow configuration.** Every daemon, pass and dispatch
lifecycle executes from a declared flow; only the **step logic** — classifiers, gates, effects (spawn a
session, merge a PR, label, smoke a candidate) — stays in code that the configuration calls. This card does
not ask *whether* to migrate; it asks **how**, staged safely. Describe-only is the first slice, not an end
state.

Why: on 2026-09-26 most daemon breaks were knock-on effects on a LATER step of a flow (cwd moved to scratch in
#2701 → lane edit permission lost; the off-lock smoke in #2731 → candidate env stripped; a retargeted stacked PR
→ CI never re-ran), or states with no owner and waits with no bound. When the lifecycle is buried across
daemons and passes, nobody can see "what else does this touch". When it is configuration, the engine can refuse
an unowned state, an unbounded wait or an unprovided assumption **before** it ships.

Slice 1 is live: `we:scripts/conveyor/flows/` describes nine flows as data (states with owner / waits /
retries / escalation; steps with assumptions / provisions, cited `file:line`), generates Mermaid, and
`we:scripts/conveyor/flows/check.mjs` gates CI on unacknowledged gaps (xr05jjl).

## Open forks (not ruled — `/prepare` next)

### Fork 1 — the engine

- **A. Build on what we have: declared operations + the #4120 job model.** Flow config (the
  `we:scripts/conveyor/flows/` JSON, extended with executable bindings) drives a small in-repo interpreter:
  each step binds to a declared-operation step (`compute` / `judge` / `effect` / `confirm`,
  `we:scripts/operations/`), slow steps run as #4120 detached, reattachable jobs with durable records; state
  lives in the pinned state root. *For:* native-first, no new infra, reuses the run store / resume / call log
  that already exist, the checker is the engine's own admission test. *Against:* we become the maintainers of a
  workflow engine (timers, retries, idempotency, crash recovery are hard to get right); the interpreter is a new
  critical path on a laptop.
- **B. Adopt an engine (Temporal, or a lighter durable-execution library such as Restate / Inngest / a local
  SQLite-backed one).** *For:* timers, retries, history, replay and visibility are solved and battle-tested; a
  real UI for "what is running". *Against:* a server process becomes the critical path of every daemon (one more
  thing to keep alive on one Mac — the very class of failure we are fighting); workflows-as-code (Temporal's
  model) is not configuration, so it misses the "pure config" goal unless we add our own DSL on top; vendor
  lock-in on the durable history format; heavier to run in CI and on a second Mac (#4086).
- **C. Stay describe-only (flows are documentation + a CI gate; code stays the executor).** Listed for
  completeness — it is the current slice, and it is **below the operator's stated target**. Its value (gap
  detection) decays as the description drifts from the code, because nothing forces them to agree.

### Fork 2 — the config ↔ code boundary

Where does "flow" end and "step logic" begin? Proposed line: config owns states, transitions, owners,
timeouts, retry caps, escalation, assumptions / provisions and hand-offs; code owns predicates (is this PR
conflicting?), gates, judges and effects, each a declared operation with a typed input/output. Risks: config
that grows expressions until it is a bad programming language; or a boundary so thin the config is just a list
of function names. Alternatives: (i) conditions as named predicates only (no expressions in config); (ii) a tiny
expression language; (iii) code-first flows with a derived description (reverses the source of truth).

### Fork 3 — safety of the migration

- The engine as a new single point of failure: every migrated flow must keep a **fallback** (the current code
  path) behind a switch, and the engine itself must fall back to last-known-good like the daemon rebuild
  (x5wbsbc).
- Shadow mode first: the engine computes "what I would do" next to the real daemon, and diffs; it acts only after
  N days of zero diffs.
- Migration risk per flow is proportional to its blast radius (drain merges to main; review only labels).

## Proposed staged path (to confirm at /prepare)

1. **Describe** (done, xr05jjl): flows as data + graphs + CI gap gate. Keep the descriptions honest: a daemon PR
   that changes a flow updates its flow file (the step-2 "what else does this touch" review lens reads the diff
   of the flow file).
2. **Plateau view**: render the flows and their live state on Plateau `/wip` (epic #3931) — which state each PR /
   session / lane is in right now, from the same files.
3. **Migrate review first** (smallest blast radius, already on the #4120 job model): the review daemon's lifecycle
   executes from `we:scripts/conveyor/flows/review.flow.json`; the old loop stays behind a fallback switch; shadow-diff before cut-over.
4. **Then the others, one at a time, each behind a fallback**: fix → ci-heal → conflict → session-cleanup → lane
   lifecycle → daemon-rebuild / self-sync → build dispatch (tick-core) → drain / land last (it writes main).
5. **Retire** each old loop after N days on the engine with no fallback use.

## Migration inventory (every flow-like module on main at 91cc453e4)

| Module (today) | Lines | Target flow | Rough size |
|---|---|---|---|
| `we:scripts/conveyor/tick-core.mjs` (planTick: five dispatch lists, admission holds) | 1966 | build-dispatch (+ admission sub-flow) | L |
| `we:skills-src/conveyor/runner.mjs` + `we:skills-src/conveyor/supervisor.mjs` (headless runner, supervision) | 736 + 557 | build-dispatch (engine host) | M |
| `we:scripts/conveyor/reconcile-core.mjs` routing + `we:scripts/conveyor/reconcile-pass.mjs` | 1327 + 412 | fix / ci-heal / conflict routing table | L |
| `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs` + `we:scripts/conveyor/reconcile-fix-dispatch.mjs` | 691 + 1171 | fix | L |
| `we:skills-src/conveyor/review-daemon.mjs` + `we:scripts/review-runner.mjs` + review loop policy | 553 + 335 + 485 | review | M (first to migrate) |
| `we:skills-src/conveyor/pass-daemon.mjs` passes (lease-reaper, health-watch, merge-orphan-sweep, stuck-pr-watch, conflict watch) | 277 host | one flow per pass | S each |
| `we:scripts/conveyor/ci-red-recovery-watch.mjs`, `we:scripts/conveyor/ci-queue-watch.mjs`, `we:scripts/conveyor/ci-heal-mark.mjs`, `we:scripts/conveyor/stuck-pr-watch.mjs` | ~1700 | ci-heal | M |
| `we:scripts/conveyor/parked-pr-conflict-watch.mjs` + conflict marks | ~1900 | conflict | M |
| `we:scripts/merge-ai-prs.mjs` + `we:scripts/lane-drain.mjs` + `we:scripts/pr-land.mjs` + the plateau drain daemon (`plateau:tools/drain-daemon/`, ~4300) | 5439 + 1260 + 1321 | drain-land | XL (last) |
| `we:scripts/lib/daemon-rebuild.mjs`, `we:scripts/lib/daemon-self-sync.mjs`, `we:scripts/lib/daemon-overlays.mjs`, `we:scripts/lib/daemon-live-smoke.mjs`, `we:scripts/lib/daemon-clone-lock.mjs` | ~3400 | daemon-rebuild | L (engine must not depend on it: bootstrap problem) |
| `we:scripts/conveyor/session-reaper.mjs`, `we:scripts/conveyor/hung-session.mjs`, dispatch-scratch reap | ~2500 | session-cleanup | M |
| `we:scripts/lane-pool.mjs` + `we:scripts/lib/lane-lease.mjs` + `we:scripts/prune-landed-lanes.mjs` + `we:scripts/conveyor/lease-reaper.mjs` | ~5100 | lane-lifecycle | L |
| `we:scripts/conveyor/health-watch.mjs` + `we:scripts/conveyor/health-watch-core.mjs` (+ health signs) | ~1200 | health-watch (a flow that watches the other flows; natural consumer of the engine's state) | M |

Sizes: S < 1 day, M 1–3 days, L ~1 week, XL > 1 week, each including shadow mode.

## Tradeoffs to weigh at /prepare

- **Migration risk**: every cut-over can break delivery the way today's changes did; mitigated by shadow-diff +
  per-flow fallback, cost is running two paths for a while.
- **The engine as a critical path**: whichever engine, it must survive restarts, a broken login, a stale clone,
  and must itself fall back to last-known-good. Option B adds a server to keep alive.
- **Config vs code**: config wins visibility and static checking; code wins expressiveness and debugging. The
  boundary (Fork 2) decides whether we get the benefit.
- **Native-first** (memory rule 75): default to the in-repo, platform-aligned option (A) unless a library is
  clearly better; an engine would be an opt-in, not a baseline.
- **Bootstrap**: the daemon-rebuild flow updates the engine itself — it cannot run on the engine it is replacing
  without a pinned, independent path.

## Done when

1. **Ruled** — `/prepare` brings each fork to ready-to-ratify (bold defaults, prior-art survey incl. Temporal / Restate / Inngest / XState); the operator rules; the rule is codified in `we:docs/agent/platform-decisions.md` and `codifiedIn` is set.
2. **Sliced** — the staged path above is filed as child cards (Plateau view, review migration, then one per flow behind a fallback).
