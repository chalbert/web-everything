---
bornAs: xqbo107
kind: decision
parent: "3383"
status: open
dateOpened: "2026-08-30"
preparedDate: "2026-09-01"
tags: []
relatedReport: reports/2026-09-01-conveyor-dispatcher-validation-substrate.md
---

# No sandbox or fixture-repo way to validate a change to the dispatcher itself without running it against real backlog items and real PRs

#3383 own text names this risk directly ("even before any of its code has landed -- it is taking real actions against real PRs and real shared state") but no card addresses it. The epics own "still not done" list makes the gap concrete: the planned "live end-to-end test" is explicitly a scratch clone of the recovered branch plus "picking one specific low-stakes backlog item to actually dispatch" -- a real item, real PR, real shared state, chosen only for being low-stakes, not a synthetic fixture. we:skills-src/conveyor/runner.mjs and we:skills-src/conveyor/supervisor.mjs carry no dry-run/shadow/canary mode (grepped for dry-run, dryRun, canary, shadow mode -- none), and we:scripts/operations/dispatch-lane.mjs only guards against running FROM a lane checkout (assertNotALaneCheckout), not against dispatching AGAINST a non-production target repo/backlog. So every future change to the dispatcher machinery itself inherits the same choice: skip live validation, or validate against production. Checked the backlog for an existing sandbox/fixture-repo/staging-environment card scoped to the conveyor/dispatcher (grepped sandbox, "fixture repo", "scratch repo", "staging environment", "validate the dispatcher" across we:backlog/*.md and we:docs/agent/*.md) -- none found; the closest hits are all for unrelated subsystems (polyglot panel dry-run flags, workflow orchestrator dry-run, plateau-loop rewrite).

**Grounded in a prior-art pass** over this repo's own ratified test-substrate statute plus a live read of every
seam the dispatcher chain already has, published as
[`we:reports/2026-09-01-conveyor-dispatcher-validation-substrate.md`](../reports/2026-09-01-conveyor-dispatcher-validation-substrate.md)
(no external browser-standards survey — this is internal tooling/testing infra, not a UX/protocol design; prior
art here means this repo's own ratified statute + its own existing seams). Central finding: **the fixture
question is not open — [`#skill-memory-replay-substrate`](../docs/agent/platform-decisions.md#skill-memory-replay-substrate)
(#2274) already rules it** for mutating tooling ("ephemeral throwaway clone off a fixture corpus, never `--dry-run`
as fidelity substrate"), and the dispatcher chain already carries most of the seams that pattern needs — they are
just unfinished/unwired, not absent. The two forks below are narrower than the item's own framing: not "fixture
vs. dry-run vs. accept the risk" (settled), but *which two layers* need the pattern finished, and how.

## Grounding digest

- **`--repo` is already threaded through the deterministic state-read/plan layer, but incompletely.**
  `we:scripts/conveyor/tick-core.mjs:892-945` passes `--repo=<owner/repo>` into
  `we:scripts/readiness/conveyor-state.mjs`, which forwards it to the `lane-pool status` and
  `scope-lease-collect` sub-reads (`we:scripts/readiness/conveyor-state.mjs:764-772`) — but its own `gh pr list`
  call three lines later (`we:scripts/readiness/conveyor-state.mjs:777`) hardcodes `{ cwd: ROOT }` and drops the
  flag; `we:scripts/readiness/dispatch-plan.mjs` has no override for its `we:backlog.mjs build-queue` read at all
  (`we:scripts/readiness/dispatch-plan.mjs:332`, the unguarded `runJson('node', [BACKLOG_CLI, 'build-queue', …])`
  call).
- **The live-agent-spawn sink is already injectable, but never chained to a fixture-driven upstream run.**
  `we:scripts/operations/dispatch-lane-io.mjs:740-754` (`createDispatchSinks`) takes `spawnAgent` as a first-class
  parameter, already faked throughout `we:scripts/operations/__tests__/dispatch-lane.test.mjs`; a companion
  "fake binary on `PATH`" harness (`we:scripts/operations/__tests__/helpers/fake-claude.mjs`'s `withFakeClaude()`,
  proven in `we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs`) already validates the REAL default
  spawn path against a fake `claude` executable, not an injected override.
- **`#2274`'s own scope caveat draws the exact line this item needs.** It settles *where the mutation runs*, and
  explicitly excludes "driving an LLM judgment (Tier-B) skill deterministically enough to assert on" as a
  separate, unsolved problem (#2272) "no substrate choice resolves." The dispatcher's deterministic wiring
  (which item gets picked, what argv gets built, which lane gets acquired) is squarely inside #2274's solved
  territory; the dispatched agent's own behavior once spawned is squarely inside its excluded territory. That
  split *is* the two forks below.
- **`we:skills-src/conveyor/supervisor.mjs`** (named in this item's own prose) does not exist on `main` — per
  `we:backlog/3397-conveyor-supervisor-has-no-reload-lifecycle-only-crash-resta.md`, it ships only on the
  still-unlanded `origin/lane/mechanical-dispatcher`. It is a process-lifecycle wrapper around `we:runner.mjs`
  (crash-restart, signal-forwarding), not a fresh decision surface — once it lands, the same substrate this item
  ratifies for `we:runner.mjs`/`we:tick-core.mjs` applies to it unchanged; it is not re-forked here.
- **Classification pass.** Both forks are build-infra/test-infrastructure calls, not a standard/intent/protocol
  shape — Q1–Q3/Q5/Q7 (layer, protocol-vs-intent, axis-exposure, DI-injectability-as-a-consumer-knob,
  seam-between-intents) don't fire. Q4 (config dimension?): no — "validate the deterministic core against a
  fixture" and "validate it only in production" are not two legitimate coexisting end-states a consumer picks
  between; one is the defect this item exists to close. Q6 (most-permissive default): the fixture-first default
  is also the *more* permissive one operationally — it adds a new, cheaper validation path without removing the
  option of an occasional full-fidelity live run (Fork 2, option (b), kept available, just not the default).

## Recommended path at a glance

| Fork | Recommended default | Main alternative (rejected as default) | Confidence |
|---|---|---|---|
| **Fork 1** — deterministic core (state-read + plan) | **finish the `--repo`/fixture-root thread** (close the `we:conveyor-state.mjs:777` gap, add a backlog-root override to `we:dispatch-plan.mjs`) + a fake-`gh`-on-`PATH` harness, mirroring `withFakeClaude()` | a `--dry-run` flag on the production path | high — #2274 already rules this axis |
| **Fork 2** — live-spawn sink (dispatch-lane) | **chain the existing injected/faked `spawnAgent` seam** into an end-to-end fixture run of the whole tick → plan → dispatch-lane pipeline | actually spawn a real disposable `claude` agent every time as the default regression gate | high — #2274's own scope caveat excludes agent-judgment fidelity from what a substrate can guarantee |

## Fork 1 — validation substrate for the deterministic state-read/plan core

*Fork-existence:* a CI-run exercising a change to `we:scripts/readiness/conveyor-state.mjs` /
`we:scripts/readiness/dispatch-plan.mjs` / `we:scripts/conveyor/tick-core.mjs`'s IO shell either actually
executes those `gh`/`we:backlog.mjs`/`we:lane-pool.mjs` shells against controlled inputs, or it doesn't validate the
wiring at all (only the already-fake-driven pure functions inside them) — an exercised IO shell and an
unexercised one are not simultaneously true. #2274 forecloses one of the two coherent-looking answers
(trust a `--dry-run` preview) as unfaithful by construction, so this fork chooses among what's left.

- **(a — recommended) Finish threading a fixture root through the existing seam, backed by a fake-`gh`-on-`PATH`
  harness.** Concretely: (1) fix `we:scripts/readiness/conveyor-state.mjs:777` to append `--repo=${flags.repo}`
  to the `gh pr list` call, matching the `poolArgs`/`scopeArgs` calls immediately above it; (2) add a
  `--backlog-dir` (or equivalent) override to `we:scripts/readiness/dispatch-plan.mjs`'s `we:backlog.mjs
  build-queue` shell, and to `we:scripts/backlog.mjs` itself; (3) write a `withFakeGh()` test helper beside
  `we:scripts/operations/__tests__/helpers/fake-claude.mjs`, same shape (a fake `gh` executable first on `PATH`
  that answers `pr list`/`pr view --json comments` with canned fixture JSON); (4) a new harness test
  (`we:scripts/conveyor/__tests__/`) that `mkdtempSync`s a throwaway backlog dir seeded with a small synthetic
  corpus, points `we:conveyor-state.mjs`/`we:dispatch-plan.mjs`/`we:tick-core.mjs` at it via the flags from (1)–(2) with
  `withFakeGh()` on `PATH`, and asserts the resulting `decisions` (spawn/watch surface) against the fixture. This
  is #2274's ratified pattern (`mkdtemp` + fixture corpus, never `--dry-run`-as-fidelity, never the shared lane
  pool) applied to the one remaining un-fixtured layer, closing two gaps this report's grounding pass found live
  in the tree rather than inventing new infrastructure.
- **(b — rejected as default) A `--dry-run`/shadow flag on the production IO shell.** #2274 already rules this
  out by name for exactly this reason: a dry-run branch of the production code is a *different code path* than
  the one that runs for real, so a green dry-run proves the preview branch works, not the branch the fixture
  needs to regression-guard. It remains fine as an *operator-preview* convenience (a human eyeballing "what would
  the next tick do" before a live run) — just not as the thing #3402 asks for, a substrate that validates a code
  *change* before it touches production.
- **(c — rejected) Status quo — validate only against production.** The excluded/broken branch: this is the risk
  #3402 itself exists to close, and it is the option every future dispatcher-core change silently defaults to
  today for lack of an alternative.

```js
// we:scripts/readiness/conveyor-state.mjs — the one-line fix for the incomplete thread (:777)
const prListArgs = ['pr', 'list', '--state', 'open', '--limit', '100', '--json',
  'number,state,statusCheckRollup,labels,headRefName,mergeStateStatus'];
if (typeof flags.repo === 'string') prListArgs.push(`--repo=${flags.repo}`); // was missing — matches poolArgs/scopeArgs above
const out = execFileSync('gh', prListArgs, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
```

Skeptic: SURVIVES-WITH-AMENDMENT — the `:777` gap and the missing backlog-root override are both real, verified
against the live tree (the `poolArgs`/`scopeArgs` asymmetry at `we:conveyor-state.mjs:764-772` vs `:777` holds;
no `--dry-run` flag exists anywhere in the three files today, so option (b) preempts a plausible future addition
rather than rejecting something live); amended only the citation above from the original
`we:dispatch-plan.mjs:288-321` (the setup/comment block) to the actual unguarded call at `:332`.
Screen: clear — a `--dry-run` branch is structurally a different code path than the real one even at zero
build/maintenance cost, so the merit gap over option (b) survives the free-to-build test; not cost dressed as
design.

## Fork 2 — validation substrate for the live-agent-spawn sink

*Fork-existence:* the seam between "the plan the deterministic core produced" and "the argv/lane-acquisition the
dispatch sink actually executes" either gets exercised end-to-end by something other than a real production
dispatch, or it does not — those are mutually exclusive as "the seam is covered."

- **(a — recommended) Chain the existing faked-sink pattern through the whole pipeline, spawning zero real
  agents.** Two fidelity levels already ship here and both extend cleanly: `we:scripts/operations/dispatch-lane-io.mjs:740-754`'s
  `createDispatchSinks({ spawnAgent, … })` takes an **injected** fake `spawnAgent` — the lower-fidelity seam
  already exercised throughout `we:scripts/operations/__tests__/dispatch-lane.test.mjs` (e.g. `:629`, `:1294`),
  good for asserting argv/guard logic in isolation; `we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs`
  proves the REAL default `execFileSync('claude', …)` path with `we:scripts/operations/__tests__/helpers/fake-claude.mjs`'s
  `withFakeClaude()` — a fake binary placed first on `PATH`, no override — the higher-fidelity seam. The
  end-to-end fixture harness this fork ratifies chains the HIGHER-fidelity one: extend Fork 1(a)'s harness one
  hop further, running the REAL `we:tick-core.mjs`/`we:dispatch-plan.mjs`/`we:dispatch-lane.mjs` argv-building +
  guard logic against the fixture state with `withFakeClaude()` on `PATH` (not an injected `spawnAgent`), so the
  harness proves the actual default spawn code path, not a substitute for it. This validates 100% of the
  deterministic wiring (item selection, argv shape, lane acquisition, guard/backoff/`assertNotALaneCheckout`
  behavior) with zero real sessions started and zero real backlog items or PRs touched — directly answering the
  item's own wording ("without running it against real backlog items and real PRs").
- **(b — kept available, not the default) Actually spawn one real, disposable `claude` session against a fixture
  repo end to end.** Buys full black-box fidelity including the dispatched agent's own behavior — but #2274's own
  scope caveat says exactly this cannot be a *deterministic regression substrate* ("driving an LLM judgment
  deterministically enough to assert on is a separate, unsolved #2272 problem"): the outcome varies run to run,
  so it can't gate "did my code change break the wiring" the way a fixture assertion can, and it re-introduces
  the real-session cost every time. Stays available as an occasional full-fidelity smoke check (what the epic's
  own "still not done" list already describes), not as the thing that runs on every dispatcher-core change.
- **(c — rejected) Status quo — validate the sink only by code review + eventually picking one real low-stakes
  item.** The excluded branch this item names directly; superseded by (a), which is strictly cheaper and already
  half-built.

```js
// A fixture-driven end-to-end assertion (shape, not final code) — Fork 1's harness extended one hop,
// using the HIGH-fidelity fake-binary-on-PATH seam (withFakeClaude), not an injected spawnAgent override —
// this proves the REAL default createDispatchSinks() code path, per we:dispatch-spawn-live.test.mjs.
const fake = withFakeClaude();
const { decisions } = tickOnce(fixturePayload); // real tick-core, real dispatch-plan, fixture state (Fork 1)
for (const build of decisions.spawnBuilds) await createDispatchSinks({ root: FIXTURE_ROOT })[DISPATCH_EFFECT](build);
expect(fake.lastArgv()).toEqual(EXPECTED_ARGV_FOR_FIXTURE); // proves the real spawn path, spawns nothing real
fake.cleanup();
```

Skeptic: SURVIVES-WITH-AMENDMENT — the default (fixture-chain the fake-sink pattern, no real spawn as the CI
gate) is correctly grounded in #2274's scope caveat and matches the live seams (`createDispatchSinks` at
`we:dispatch-lane-io.mjs:740`, `assertNotALaneCheckout` checks only the checkout basename); amended to resolve
the internal contradiction the skeptic caught — the snippet now uses `withFakeClaude()` (the fake-binary-on-`PATH`
seam) instead of an injected `spawnAgent` override, so it actually proves the real default code path the prose
claims, rather than the weaker seam the pattern's own source warns against overriding.
Screen: clear — the split tracks a real, cited scope line (#2274 solves deterministic wiring; #2272 leaves LLM
judgment unsolved); option (b)'s defect is non-determinism, not expense, so the merit gap survives even at zero
build/maintenance cost; option (b) is kept available rather than excluded, which is the right shape for a
genuine, not cost-driven, fork.

## Supported by default / not forks

- **Exact test-file layout, helper naming, and fixture-corpus contents** — impl detail below the observable
  contract (the contract is: the deterministic core and the dispatch sink are each exercised end-to-end against
  controlled, non-production inputs, spawning nothing real). A future implementer picks the vitest file
  locations, the `withFakeGh()` API shape, and how many synthetic backlog/PR states the corpus covers (it must
  at minimum cover an open build-ready item, a blocked item, an in-flight `review:changes` PR, and a red-CI PR —
  the branch conditions `we:tick-core.mjs`'s pure functions already switch on).
- **`we:skills-src/conveyor/supervisor.mjs`, once it lands** — not re-forked; it is a thin process-lifecycle
  wrapper around the already-fixtured `we:runner.mjs`, so Fork 1/2's substrate applies unchanged. Worth a one-line
  note on `we:backlog/3397-conveyor-supervisor-has-no-reload-lifecycle-only-crash-resta.md` (or a sibling) at
  landing time, not a fresh decision.
- **Whether the new fixture harness runs in the standard `vitest` suite (CI-gated) or as a separate on-demand
  script** — impl detail; either satisfies the contract, and this repo already runs its skill/memory replay
  suite (#2274's own pattern) inside the standard test run, so that is the natural default absent a reason
  otherwise.

## Follow-on builds (not yet scaffolded)

- Close the `--repo` thread gap + add a `--backlog-dir` override; ship `withFakeGh()`; add the fixture harness
  test asserting `we:conveyor-state.mjs` → `we:dispatch-plan.mjs` → `we:tick-core.mjs` end to end (Fork 1) · build ·
  scope: `we:scripts/readiness/conveyor-state.mjs,we:scripts/readiness/dispatch-plan.mjs,we:scripts/backlog.mjs,we:scripts/conveyor/tick-core.mjs,we:scripts/conveyor/__tests__/`
- Extend the fixture harness through `we:dispatch-lane.mjs`'s real argv-building/guard logic with only `spawnAgent`
  faked, asserting the produced argv against the fixture (Fork 2) · build · blockedBy: the item above ·
  scope: `we:scripts/operations/dispatch-lane.mjs,we:scripts/operations/dispatch-lane-io.mjs,we:scripts/operations/__tests__/`

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (predicted touch-set is dispatcher/build-infra `scripts/` machinery — blast-radius signal).
This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
