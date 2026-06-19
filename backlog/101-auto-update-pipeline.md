---
type: decision
workItem: story
size: 5
parent: "099"
status: resolved
blockedBy: ["102", "094"]
dateOpened: "2026-06-06"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "protocol:update-policy"
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-11"
tags: [auto-update, evergreen, change-management, dependencies, risk-analysis, phased-rollout, reversion, pre-test, monitoring, ci]
relatedReport: reports/2026-06-11-auto-update-pipeline.md
relatedProject: webreliability
crossRef: { url: /backlog/099-evergreen-app-vision/, label: "Evergreen app (#099)" }
---

# Auto-update pipeline — keep an app on the latest deps/standards safely, with risk gates and reversion

Define the **update orchestration** that lets an app stay current automatically: when a new dep or Platform standard ships, run a controlled pipeline — security analysis, cool-off, auto-branch + auto-test, gates, merge/deploy, monitor, revert. This is the *change-management* engine of the evergreen app ([#099](/backlog/099-evergreen-app-vision/)); distinct from the **upgraders** (#094, which transform code) — this is the *policy + workflow* deciding when an update runs and how it's made safe. The two forks below — where the pipeline lives, and the gate model — are grounded in a published [Auto-update pipeline](/research/auto-update-pipeline/) survey, each with a **bold** default.

## Axis framing

The change-management ecosystem already splits two things WE keeps independent. **(a) Policy declaration vs. the runner:** every tool separates a committed policy file (`we:renovate.json`, `we:.github/dependabot.yml`, `we:.changeset/config.json`, `.releaserc`) from a swappable engine — the declared policy is portable, the runner is infrastructure. That is the protocol-is-the-only-lock shape WE already ships twice: the **Guard** protocol resolves a region policy through a swappable provider ([we:protocols.json:94](../src/_data/protocols.json#L94)) and **render-strategy** resolves a declared strategy through a registry ([we:protocols.json:70](../src/_data/protocols.json#L70)); the runner lane is reliability/Plateau-service ([we:projects.json:159](../src/_data/projects.json#L159)). **(b) The gate is graded config, not one mechanic:** Renovate's `minimumReleaseAge` + Merge Confidence + auto-merge boundaries grade by severity and signal; the consumed migration/codemod machinery is already homed upstream — the **changelog-manifest** protocol ([we:protocols.json:86](../src/_data/protocols.json#L86)) links a breaking entry to its codemod with integrity-hash trust (#102), and the **upgrader engine** runs it (#094, `we:blocks/renderers/upgrader/upgraderEngine.ts`). The pipeline *consumes* #102/#094 — hence the `blockedBy` chain — and adds the WE-only edge of Platform-side pre-testing against consumers' suites before release (#092 graph).

### Recommended path at a glance

Ratify both rows, or override the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · home** | **thin protocol** declares update policy + capability; orchestration is a Plateau/reliability **service** | monolithic project, or hardcoded runner *(rejected)* | **High** — universal config-vs-runner split; mirrors Guard/render-strategy |
| **2 · gate model** | **graded configurable policy** on one axis: pre-merge (buffer → confidence/severity → auto-low-risk-green / human-major+visual) + post-deploy staged rollout (metrics → auto-rollback) | one hardcoded gate (all-manual, or all-auto) *(rejected)* | **Med-high** — alt legit only as a *flavor*, not a baked constant |

## Fork 1 — where does the pipeline live? (protocol vs service)

Every automated-update tool separates a **declared policy** (committed, portable) from the **runner** (swappable infra): Renovate/Dependabot/changesets/semantic-release all read a config file, and the same grammar runs under Mend-hosted, self-hosted, or GitHub-native engines ([research finding 1](/research/auto-update-pipeline/)). WE already ships this shape: Guard ([we:protocols.json:94](../src/_data/protocols.json#L94)) and render-strategy ([we:protocols.json:70](../src/_data/protocols.json#L70)) both declare a policy/strategy resolved by a swappable provider.

- **(A — recommended) Thin protocol declares update policy + capability; orchestration is a Plateau/reliability service.** The contract an app declares is the escapable lock (protocol-is-the-only-lock); the runner is disposable leverage ([we:projects.json:159](../src/_data/projects.json#L159)). Same registry+provider pattern as Guard. Ties #092/#089. Cost: a protocol to author + a service to build (the service is the deferred build, gated on #102/#094).
- **(B) A monolithic "auto-update project" that owns both the contract and the runner.** Couples the escapable lock to disposable infra; the consumer can't swap the runner without leaving the standard. Rejected — violates minimize-lock-in.
- **(B′) Hardcode the runner with no declared contract.** No portability, no conformance surface. Rejected.

## Fork 2 — the gate model (manual approval vs automated-with-gates vs staged)

No surveyed tool hardcodes a single gate; all expose a **graded policy keyed to severity + signal** — stability buffer (`minimumReleaseAge`), merge confidence, and auto-merge boundaries (auto low-risk-green, human-gate major + visual-diff) ([research finding 2](/research/auto-update-pipeline/)). And the spectrum has two endpoints both shipping in the wild: semantic-release is full-auto (no human), changesets inserts a human checkpoint PR ([finding 3](/research/auto-update-pipeline/)) — both legitimate modes of *one* pipeline. Progressive delivery (Argo/Flagger) adds a *post-deploy* metric gate driving auto-rollback ([finding 4](/research/auto-update-pipeline/)), so the model is really two gates on one axis.

- **(A — recommended) Graded, configurable gate policy with safe defaults, on one axis.** Pre-merge: cool-off buffer → confidence/severity classification (from #102's strictest-wins severity) → **auto-merge patch/minor-green, human-gate major + visual-diff**. Post-deploy: staged rollout → metric analysis → auto-rollback on regression. The "visual-diff + major = human, patch/minor-green = auto" rule is the **default flavor a project config extends**, not a constant in the tool (config-extends-platform-default + most-flexible-default). Failed auto-updates tag for human intervention by configurable criteria.
- **(B) One hardcoded gate — all-manual, or all-auto.** Both poles exist (changesets / semantic-release) but baking either denies the other legitimate end-state. Rejected — this is a configurable dimension, not a fixed mechanic.
- **Sub-decision (ratify with the default):** whether the post-deploy staged-rollout gate is in v1 scope or a follow-on. Recommendation: declare the gate vocabulary in the protocol now; the runner implements pre-merge first, staged rollout second.

## Preserved context — the pipeline (from the essay)

1. **Trigger** — a new dep/standard version is published.
2. **Security analysis** — scan the new version before anything else.
3. **Cool-off / buffer period** — a configurable wait before adopting (avoid chasing every whim). *(= Renovate `minimumReleaseAge`.)*
4. **Auto-branch + auto-test** — apply the update in a branch, run the full suite; breaking changes drive automatic codemods via the shipped **migration scripts** (#094) + the **changelog manifest** (#102).
5. **Risk analysis from the changelog** — classify (major/minor/patch) and route; **approval for visual diffs and high-risk; auto-merge low-risk green.**
6. **Phased rollout + reversion protocol** — staged deploy, automated rollback on regression. *(= progressive delivery metric gate.)*
7. **Monitoring** — track functional/visual regression in prod continuously; failed auto-updates tag for human intervention with configurable criteria.

### Pre-testing (the platform's edge)

A **Platform-side** update can be **pre-tested against its consumers' suites before it is even released**, so compatibility is known up front — the introspectable relationship graph (#092) supplies *which* apps to pre-test. The difference between "hope the bump is safe" and "we already proved it against your build." No industry analogue surveyed — WE's net-new edge.

## Open questions (carried)

- Strong dependency on machine-readable change descriptors (#102) and shipped migration scripts (#094); those sequence first (reflected in `blockedBy`). The orchestration service is the remaining build once they land.
- How migration scripts are authored, versioned, and trusted (they run codemods on consumer code) — the security/trust angle; #102's per-entry author + integrity-hash trust metadata is the substrate.

## Progress

**Status:** open — prepared 2026-06-11 into prepared-fork shape; grounded in `relatedReport`. Stays `blockedBy` #102/#094 (sequence those first; the orchestration service is the remaining build). Both forks lean the same way: a thin declared protocol (the lock) + a swappable runner (disposable), with a graded configurable gate whose safe defaults a project config extends.

## Resolution (partial) — 2026-06-11

- **Fork 2 — graded configurable gate policy**: ratified. No surveyed tool hardcodes one gate; the model is one graded axis — pre-merge (cool-off buffer → confidence/severity → auto-merge patch/minor-green, human-gate major + visual-diff) plus post-deploy staged rollout (metric analysis → auto-rollback). The "auto low-risk-green / human major+visual" rule is the safe-default flavor a project config extends, not a baked constant (config-extends-platform-default + most-flexible-default + dimension-vs-fixed-mechanic). The post-deploy staged-rollout gate's vocabulary is declared now; the runner implements pre-merge first, staged rollout second.

**Open — needs a human call:** Fork 1 — the home: it ratifies the config-vs-runner *split* in shape, but the concrete naming/scope commit stays open — which Plateau/reliability **service** owns the orchestration (the runner home, cf. [we:projects.json:159](../src/_data/projects.json#L159) / `relatedProject: webreliability`) and the thin protocol's name — plus its sequencing behind #102 (changelog-manifest) and #094 (upgrader engine), reflected in `blockedBy`. Because this is a net-new project-scope + naming commit on a shared registry and depends on the blocked items landing first, it needs a human decision rather than mechanical ratification.

## Resolution (Fork 1) — 2026-06-13

Both `blockedBy` items have since landed (#102 → `changelog-manifest` protocol under webmanifests; #094 → `we:upgraderEngine.ts`), so the sequencing concern is moot — the home call is unblocked. **Ratified:**

- **Protocol home + name: the `update-policy` protocol, owned by `webmanifests`** ([we:protocols.json](../src/_data/protocols.json) `update-policy`, anchor `protocol-update-policy` on [we:project-webmanifests.njk](../src/_includes/project-webmanifests.njk)). The declared update policy is a committed, portable config — we:renovate.json's WE analogue — and it sits directly beside the `changelog-manifest` it *consumes*; co-homing the change-descriptor and the act-on-change policy under one project is the tight coupling. The *policy* is the lock (named `update-policy`, not `pipeline`); the pipeline is the runner.
- **Rejected — webreliability for the artifact.** Reliability's charter is *runtime* failure-recovery handlers ("mechanism failures, not input invalidity"); build-time change-management policy is neither runtime nor failure-recovery, so homing the protocol there would blur that crisp line. The `relatedProject: webreliability` tag fairly describes the *runner's* operational flavor, not the standard artifact.
- **Rejected — a new "Web Evergreen" project.** The whole evergreen family deliberately scatters into existing charters (#094→webadapters impl, #102→webmanifests, #088→webadapters, #092→webregistries) rather than forming one project; adding a project for #101 alone breaks that established pattern.
- **Runner: a Plateau-app service — a deferred build, not a WE standard artifact** (constellation-layering ruling: standard→WE, runner→Plateau). Carved to **[#497](/backlog/497-auto-update-orchestration-runner-plateau-service-execute-the/)** (implements pre-merge first, staged rollout second; the concrete service name is a build-time detail deferred there). The protocol declares the full graded-gate vocabulary (incl. staged-rollout terms) now.

Graduated to: the `update-policy` protocol (webmanifests).

**Graduated to** `protocol:update-policy` — Update Policy (concept) — webmanifests' second protocol; declared portable auto-update policy (we:renovate.json analogue), graded gate; runner is a deferred Plateau service (#497); consumes #102/#094.
