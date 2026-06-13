---
type: issue
workItem: story
size: 8
parent: "099"
status: open
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
tags: [auto-update, evergreen, orchestration, runner, plateau-service, phased-rollout, reversion, ci]
relatedProject: webreliability
crossRef: { url: /backlog/101-auto-update-pipeline/, label: "Auto-update pipeline / update-policy protocol (#101)" }
---

# Auto-update orchestration runner (Plateau service) — execute the update-policy protocol

Build the runner that executes the `update-policy` protocol (#101's graduate, owned by webmanifests). The declared policy is the standard lock; this runner is the swappable Plateau/reliability service that acts on it — disposable infra, not a WE artifact (constellation-layering). Implements the graded gate in two stages: pre-merge first (new-version trigger → security scan → cool-off → severity from the changelog-manifest → auto-test → auto-merge patch/minor-green, human-gate major + visual-diff via the upgrader engine), then post-deploy staged rollout (metrics → auto-rollback). Carries the WE-only edge: pre-test a version against consumers' suites before release via the provider-consumer graph (#092). Blockers #102/#094 resolved.


## Home/locus fork (2026-06-13, batch pre-flight) — needs a `/decision` before build

Not agent-ready as written. Two blockers surfaced on claim:

1. **No build home (constellation-layering fork).** The body states the runner is *"disposable infra, **not a WE artifact**"* — so it cannot be built or gated in webeverything (it would be a standards-layer artifact, which the ruling says it is not). But there is **no home set**: it is not a served-product feature either, so plateau-app is not an obvious fit, and no release-infra repo exists in the constellation. Where disposable auto-update **release infra** lives (plateau-app vs a dedicated release-infra home vs a CI-config artifact) is an **unsettled home decision** — `/decision` it against [[managed_offering_constellation_layering]] before any build. The `update-policy` protocol summary itself calls this runner *"the deferred build."*
2. **Epic-scope, no scaffold.** A grep confirms **zero** existing runner/orchestration scaffold in any repo. The acceptance — trigger → security scan → cool-off → severity classification → auto-test → auto-merge → staged rollout → auto-rollback → consumer pre-testing via the #092 graph — is net-new CI/CD orchestration, far beyond `story·8`. After the home decision it should be **/slice**d (pre-merge gate first, post-deploy rollout second, consumer pre-test third).

Released unclaimed during a batch; the protocol it executes (`update-policy`) already exists in webmanifests — the *lock* is shipped, only the swappable runner is deferred.
