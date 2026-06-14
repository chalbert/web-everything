---
type: decision
workItem: story
size: 8
parent: "099"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-13"
relatedReport: reports/2026-06-13-auto-update-runner-execution-topology.md
tags: [auto-update, evergreen, orchestration, runner, plateau-service, phased-rollout, reversion, ci]
relatedProject: webreliability
crossRef: { url: /research/auto-update-runner-topology/, label: "Auto-update runner execution topology survey" }
---

# Auto-update orchestration runner — execute the update-policy protocol

**Prepared decision — ready to ratify.** The `update-policy` protocol (the *lock*) already shipped via
[#101](/backlog/101-auto-update-pipeline/) ([protocols.json:110-115](../src/_data/protocols.json#L110-L115)),
which named this runner "the deferred build." No runner design exists yet. The prep survey
([`/research/auto-update-runner-topology/`](/research/auto-update-runner-topology/), report
`reports/2026-06-13-auto-update-runner-execution-topology.md`) **reshaped the pre-flight's "home" framing
into a single genuine fork**: *build a bespoke runner vs. compose the engines the ecosystem already
commoditized.* Everything the pre-flight called a "home decision" ratifies by precedent. The one fork
below carries a **bold** recommended default.

## Axis framing

The pre-flight flagged "no build home" because a runner was assumed to be a standalone vendor-operated
service, and plateau-app cannot run scheduled CI/CD in its current phase (plateau-app/CLAUDE.md "THE PHASE
RULE": **no backend in the MVP** — browser-only, flat-cost, revenue-first; a hosted/operated tier is a
*parked* later phase, #554, not forbidden). The survey dissolves that premise on four findings, which
split the concern into one real call plus a ratify-cluster:

- **Execution is CI-native, not a bespoke service.** Dependabot consolidated its compute onto GitHub
  Actions (self-hosted runners + Kubernetes ARC, GA 2025-05); Renovate ships one runner three ways from
  one codebase (hosted app / self-hosted app / self-hosted GitHub Action) off one `renovate.json`. The
  modern shape is a **portable package + committed CI templates running in the consumer's own CI** — no
  new repo, maps onto open-core-by-usage and the self-run > service operational ranking.
- **Pre-merge and post-deploy execute in different homes by nature.** Pre-merge (trigger → scan → cool-off
  → test → severity → merge) is CI-time (Renovate/Dependabot); post-deploy staged rollout (metrics →
  rollback) is a deploy-time **in-cluster controller** (Argo Rollouts CRD / Flagger). There is no single
  runner, so "where it lives" was never one answer — WE declares the policy and emits config into each
  existing substrate.
- **The commoditized core is solved; the net-new WE edge is the cross-consumer pre-test.** Trigger /
  cool-off / scan / test / auto-merge / metric-rollback are all off-the-shelf. The one capability no
  incumbent offers is pre-testing a provider version against its *consumers'* suites before release, via
  the [#092 provider↔consumer graph](/backlog/092-provider-consumer-graph-platform-manager/) (graduated to
  `webregistries`).
- **A pure compile-to-`renovate.json` adapter is lossy.** `update-policy` carries severity from the
  [changelog-manifest](../src/_data/protocols.json#L94-L99) (strictest-wins, #102), migration linkage run
  by the upgrader engine ([blocks/renderers/upgrader/upgraderEngine.ts](../blocks/renderers/upgrader/upgraderEngine.ts), #094),
  a unified pre+post gate axis, and the #092 edge — none of which Renovate models. So the runner can't be
  *only* a config emitter.

### Recommended path at a glance

Ratify the row, or override it. The ratify-cluster below it is settled by precedent (no judgment needed).

| | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1 · build vs. compose** | **Thin orchestrator — built in Frontier UI (not WE; WE stays protocol-only) — that *owns* the `update-policy` gate evaluation + the #092 pre-test edge, and *drives* incumbent engines (Renovate/Dependabot pre-merge, Argo/Flagger post-deploy) as swappable execution primitives** | bespoke end-to-end runner *(rejected)*; or pure config-emitter adapter *(rejected — lossy)* | **Med-high** — native-first + the lossy-adapter finding both point here; the only real judgment is how thin the orchestrator stays |

**Ratify-cluster (settled by precedent — not separate forks):**

- **Constellation layering — no "home" decision, no new repo** (per [[managed_offering_constellation_layering]],
  same answer as [#092](/backlog/092-provider-consumer-graph-platform-manager/) Fork 3): protocol → WE
  (shipped); reusable orchestration → Frontier UI (next to the upgrader engine); operated runner +
  dashboard → plateau-app (open-core by usage) **as a parked later phase** (plateau-app Phase 2/3, #554) —
  not the MVP. The pre-flight's "no build home" blocker is **answered**: the runner decomposes like every
  managed offering rather than needing a monolithic home.
- **Execution topology — CI-native self-run floor, hosted plateau-app tier deferred** (open-core by usage;
  self-run > service ranking). Self-run is the floor *by construction* once we compose CI-native engines;
  the operated/hosted tier is out-of-phase, not forbidden — it parks under #554 behind defer-live-serve.
- **Post-deploy rollout — delegated to existing progressive-delivery controllers** (Argo/Flagger), not
  built (native-first / impl-is-not-a-standard).
- **No-leakage invariant** (per [[project_vision_is_plateau_service_no_leakage]]): no published
  `@webeverything` artifact imports the runner; the standard ships only the protocols, the runner consumes
  them.

## Fork 1 — build a bespoke runner, or compose existing engines?

**Crux.** The `update-policy` gate must be honoured faithfully (manifest-driven severity #102, migration
linkage via the upgrader engine #094, the unified pre+post axis, the #092 cross-consumer pre-test). But
the *mechanics* it gates — fetch, cool-off, test-in-branch, auto-merge, metric-rollback — are commoditized
(Renovate/Dependabot, Argo/Flagger), and the ecosystem runs them CI-native, not as a bespoke service
([survey findings 1-2](/research/auto-update-runner-topology/)). So the call is how much the runner
*builds* vs. *composes*.

- **(A — recommended) Thin orchestrator (built in Frontier UI) + composed engines.** *Home: a Frontier UI
  package next to the upgrader engine — **not** webeverything; WE ships only the `update-policy` protocol
  (no-leakage invariant, [[npm_scope_mirrors_layer]]). "WE" here means "the WE standard it serves," never
  its repo.* The runner owns *only* the WE-standard-specific
  policy evaluation (manifest severity, migration routing) and the net-new #092 pre-test edge; it drives
  Renovate/Dependabot as the pre-merge execution primitive and emits Argo/Flagger config for post-deploy.
  Native-first, minimize-lock-in, lowest build, genuinely "disposable infra," self-run floor by
  construction. Cost: a per-engine driver/adapter to author and keep current with the incumbents' config
  surfaces.
- **(B) Bespoke end-to-end runner.** Re-implements trigger → scan → cool-off → test → merge → rollout from
  scratch. *Rejected* — re-invents commoditized infra for no interop gain, violates native-first +
  minimize-lock-in, and inflates the build far beyond the WE-net-new edge.
- **(C) Pure config-emitter adapter** (compile `update-policy` → `renovate.json` + Argo config, nothing
  else). *Rejected* — silently drops the WE-specific half (manifest severity, migration linkage, #092
  pre-test); the lost cells *are* the standard's value ([survey finding 4](/research/auto-update-runner-topology/)).

**Default: A.** The genuine residual judgment is *how thin* the orchestrator stays — i.e. whether a given
gate concern is expressed in the incumbent's config or owned by the orchestrator. That is settled per-slice
at build time, not here; the principle is "compose the solved parts, own the WE-specific parts."

**Sub-decision (ratify with A):** the **#092 cross-consumer pre-test edge** is the part most suited to the
deferred *hosted* tier (it needs central graph knowledge a single-repo CI runner lacks), and it is gated on
#092's runtime graph (built-first / runtime-deferred per the #092 ruling). Scope it as the last slice.

## Ruling (2026-06-14) — Fork 1 → A, ratified

**Decision: A — a thin orchestrator built in Frontier UI** (next to the upgrader engine) that *owns* the
`update-policy` gate evaluation (manifest-driven severity #102, migration routing via the upgrader engine
#094) and the net-new #092 cross-consumer pre-test edge, and *drives* commoditized engines as swappable
execution primitives (Renovate/Dependabot pre-merge; Argo/Flagger post-deploy). B (bespoke end-to-end) and
C (pure config-emitter) are **flawed**, not merely costlier — B reinvents commoditized infra, C drops the
WE-standard-specific half that *is* the value — so A is the surviving option on merit (fork-existence test).

**Separation reaffirmed (the one wording risk caught at ratification):** the orchestrator is **not** in
webeverything. "WE orchestrator" = *WE-standard-aware*, never *in-WE*. WE ships only the `update-policy`
protocol (already shipped, #101); the orchestrator is an `@frontierui` package, the operated/hosted tier is
plateau-app — per the no-leakage invariant and [[npm_scope_mirrors_layer]] / [[managed_offering_constellation_layering]].

**Sharpening recorded:** C is not a different mechanism from A — it is *A with the owned gate-evaluation
layer amputated*; A still emits engine config for the commoditized mechanics exactly as C would. So the
residual "how thin?" judgment is purely per-slice (is *this* gate concern expressible in the incumbent's
config, or owned?), at build time — not a re-litigation of this fork.

**Ratify-cluster** (layering, CI-native self-run floor, post-deploy delegated to Argo/Flagger, no-leakage)
ratified as written. **Graduated** into the `blockedBy` slice chain below (#NNNs filled at close-out).

---

## Context

### Graduation / slice plan (a `/slice` action, *not* part of this decision)

The pre-flight's second blocker — epic-scope, zero scaffold, far beyond `story·8` — is a **slicing** matter,
not a fork. Resolving Fork 1 (A) graduates the build into a `blockedBy` chain, each slice separately
prioritized:

1. **Pre-merge orchestrator + engine driver** (FUI package): owns the gate eval, drives Renovate/Dependabot.
2. **Post-deploy rollout config-emit** (FUI): emit Argo/Flagger policy from `update-policy`.
3. **#092 cross-consumer pre-test edge** — the WE-net-new capability; gated on #092's runtime graph.
4. **plateau-app operated surface + dashboard** — the open-core hosted tier; **out-of-phase / parked**
   (plateau-app Phase 2/3, parks under #554 behind defer-live-serve), sliced now only so it has a home.

### Preserved pipeline (from the essay / #101, for the runner to honour)

1. **Trigger** — a new dep/standard version is published.
2. **Security analysis** — scan before anything else.
3. **Cool-off / buffer** — configurable wait (= Renovate `minimumReleaseAge`).
4. **Auto-branch + auto-test** — apply in a branch, run the suite; breaking changes drive codemods via the
   migration scripts (#094) + changelog manifest (#102).
5. **Risk analysis from the changelog** — classify (major/minor/patch); auto-merge low-risk-green,
   human-gate visual diffs + high-risk.
6. **Phased rollout + reversion** — staged deploy, automated rollback (= progressive-delivery metric gate).
7. **Monitoring** — track functional/visual regression in prod; failed auto-updates tag for human
   intervention by configurable criteria.

### Relationships

- Executes the `update-policy` protocol (#101, shipped) — consumes changelog-manifest (#102) + upgrader
  engine (#094), both resolved.
- The WE-only edge consumes the #092 provider↔consumer graph (`webregistries`).
- Parent epic: [#099](/backlog/099-evergreen-app-vision/) (the evergreen app).
