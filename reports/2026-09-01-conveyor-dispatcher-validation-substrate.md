# Validating a change to the conveyor dispatcher itself — prior-art + fact-check

**Session report backing [#3402](/backlog/3402-no-sandbox-or-fixture-repo-way-to-validate-a-change-to-the-d/).**
Not a browser/UX standard — this is an operational/infra decision about how the conveyor's own dispatcher
machinery gets tested, so "prior art" means: (1) what this repo has *already ratified* about test substrates for
mutating tooling, (2) what seams the dispatcher code already has, checked live against the tree, and (3) how
comparable orchestration systems validate changes to themselves without spending production side-effects.

## Statute already on point — #skill-memory-replay-substrate (#2274)

[`#skill-memory-replay-substrate`](../docs/agent/platform-decisions.md#skill-memory-replay-substrate) (ratified
#2274, 2026-07-09) already rules the general question "where does a mutating-tooling test run":

- **Ephemeral throwaway clone** (`mkdtempSync` + `git init`/`git clone` off a fixture corpus), run the *real*
  mutation, assert on the resulting tree — **never the shared lane pool** ("production infra: `acquire` exits 1
  in CI, `reset --hard origin/main` destroys any seeded fixture, a red test strands a lease that contends with the
  live drain").
- **Holds even when the case under test is the pool tooling itself**: point the real `we:scripts/lane-pool.mjs`
  at a fabricated `LANE_POOL_ROOT` under a `mkdtemp` dir, never at allocated production lanes
  (`we:scripts/__tests__/lane-pool-refresh-guard.test.mjs`).
- **`--dry-run` is explicitly excluded as the fidelity substrate**: "a dry-run of a mutating op asserts the
  *preview* branch, not the real commit/rename/merge the suite regression-guards, so 'faithful dry-run' is
  self-contradictory."
- **Scope caveat, stated verbatim**: "this settles only *where the mutation runs*; driving an LLM *judgment*
  (Tier-B) skill deterministically enough to assert on is a separate, unsolved #2272 problem that no substrate
  choice resolves."

**Citation-scope check.** Does #2274's authoring scope reach the conveyor dispatcher? Yes for the *deterministic*
layer — `we:scripts/conveyor/tick-core.mjs` / `we:scripts/readiness/dispatch-plan.mjs` /
`we:scripts/readiness/conveyor-state.mjs` are exactly "mutating-adjacent tooling" in #2274's sense: their output
(`decisions.spawnBuilds`, etc.) drives real mutations (lane acquisition, agent spawns) once executed. #2274's own
scope caveat is the one place it does *not* reach: the dispatched agent's own LLM judgment. That caveat maps
precisely onto this item's second gap (below).

## Live facts checked on this repo (2026-09-01)

- `we:skills-src/conveyor/runner.mjs:28-36` already documents a **pure-core / IO-shell split**: `carryForward`,
  `shouldStop`, `tickSurface`, `runLoop` take every effect (tick, emit, mechanical passes, heartbeat, sleep) as an
  injected function, and are unit-tested with fakes in `we:skills-src/conveyor/__tests__/runner.test.mjs` — "no
  git/network, no real lease." The runner's IO shell (`makeCliTickOnce`, `makeCliMechanicalPasses`) is the part
  with no fixture path today.
- `we:scripts/conveyor/tick-core.mjs:892-945` (the IO shell's `main()`) already threads a `--repo=<owner/repo>`
  flag into `we:scripts/readiness/conveyor-state.mjs` and forwards it again for the durable rearm/CI-heal comment
  reads (`we:scripts/conveyor/tick-core.mjs:975-979`, "Thread `--repo` exactly as the state read does… without
  it, `gh pr view` resolves the repo from cwd"). The seam for pointing the state read at a non-production target
  already exists at this layer.
- **The `--repo` thread is incomplete one level down.** `we:scripts/readiness/conveyor-state.mjs:764-772` forwards
  `flags.repo` into the `we:scripts/lane-pool.mjs status` and `we:scripts/readiness/scope-lease-collect.mjs`
  sub-reads, but the `gh pr list` call three lines later (`we:scripts/readiness/conveyor-state.mjs:777`) hardcodes
  `{ cwd: ROOT }` and never appends `--repo` — so a tick invoked with `--repo=<fixture>` today would still read
  PRs from the real production repo. A concrete gap, not a hypothetical one.
- `we:scripts/readiness/dispatch-plan.mjs:288-321` shells `we:scripts/backlog.mjs build-queue --json` with **no
  override reachable at all** — the backlog source is always the real `we:backlog/` directory. There is no flag
  threading a fixture backlog root through this file today.
- `we:scripts/operations/dispatch-lane-io.mjs:700-754` (`createDispatchSinks`, "THE SINK — the one thing in this
  repo that starts a delivery agent") already takes an **injectable `spawnAgent`** — the real default shells
  `claude`, but the parameter is a first-class seam. `we:scripts/operations/__tests__/dispatch-lane.test.mjs:14`
  states the pattern directly: *"NOTHING HERE SPAWNS AN AGENT, and that is the point of the injected
  `spawnAgent`: the argv is asserted…"* — and lines 627/651/662/721/733/745/754/1292 all fake it
  (`spawnAgent: () => ''`, or a counting/recording stub). This is exactly the seam #2274's pattern would extend
  through — it already exists at the unit level; it has never been wired into an end-to-end run of the whole
  tick → plan → dispatch chain.
- `we:scripts/operations/dispatch-lane-io.mjs:676-683` (`assertNotALaneCheckout`) guards only against being
  invoked **from** a lane clone (nesting two checkouts); it has no opinion on which repo/backlog the dispatch
  targets. This matches the item's own claim.
- **The "fake binary first on PATH" pattern already ships for `claude` itself.**
  `we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs:23-48` proves `createDispatchSinks`'s REAL
  default spawn path (`execFileSync('claude', …)`, no injected spawner override) against
  `we:scripts/operations/__tests__/helpers/fake-claude.mjs`'s `withFakeClaude()` — a fake `claude` executable
  placed first on `PATH` that parses argv the way the real commander-style CLI does. The exact same shape (a
  fake `gh` first on `PATH`, returning canned `pr list`/`pr view` JSON) is the natural extension for the
  `gh`-shelling call sites this report already flags — not a new pattern, the same one already proven one call
  away.
- No existing test or script anywhere in `we:scripts/` / `we:skills-src/` runs the **whole** chain — fixture state
  → `dispatch-plan` → `tick-core` → `dispatch-lane`'s argv-building/guard logic → a faked sink — in one pass. Each
  piece is unit-tested against fakes in isolation; the seam between them has only ever been proven by a real tick
  against production.

## Industry pattern (orchestration/dispatcher self-validation)

Systems that dispatch mutating work off their own scheduling core consistently split the same way #2274 already
rules: the **deterministic core** gets a from-fixture harness (Airflow's DAG tests run against a disposable
local metadata DB, never a shared production scheduler; Kubernetes controllers are tested against a fixture API
server — `envtest`/`kind` — never a live cluster; Temporal ships a `TestWorkflowEnvironment` that runs real
workflow/activity code against a fully faked time+task substrate), while the **side-effecting edge** (the actual
external call — a pod created, an email sent, a PR opened) is exercised through an injected fake at the same
seam the production code already calls through, not by trusting a "dry-run" flag on the production path itself.
That is the same shape `createDispatchSinks`'s injectable `spawnAgent` already gives this repo — the gap is that
nothing chains it to a fixture-driven run of the upstream planning core.

## Sources

- `we:docs/agent/platform-decisions.md#skill-memory-replay-substrate` (this repo's own ratified substrate rule).
- `we:skills-src/conveyor/runner.mjs`, `we:scripts/conveyor/tick-core.mjs`, `we:scripts/readiness/conveyor-state.mjs`,
  `we:scripts/readiness/dispatch-plan.mjs`, `we:scripts/operations/dispatch-lane-io.mjs`,
  `we:scripts/operations/__tests__/dispatch-lane.test.mjs` (read live, 2026-09-01).
- General orchestration-testing pattern (Airflow DAG tests, Kubernetes `envtest`/`kind`, Temporal
  `TestWorkflowEnvironment`) — cited as convergent industry shape, not as a specific version/API commitment.
