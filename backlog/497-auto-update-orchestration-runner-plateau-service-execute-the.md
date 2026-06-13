---
type: issue
workItem: story
size: 8
parent: "099"
status: open
dateOpened: "2026-06-13"
tags: [auto-update, evergreen, orchestration, runner, plateau-service, phased-rollout, reversion, ci]
relatedProject: webreliability
crossRef: { url: /backlog/101-auto-update-pipeline/, label: "Auto-update pipeline / update-policy protocol (#101)" }
---

# Auto-update orchestration runner (Plateau service) — execute the update-policy protocol

Build the runner that executes the `update-policy` protocol (#101's graduate, owned by webmanifests). The declared policy is the standard lock; this runner is the swappable Plateau/reliability service that acts on it — disposable infra, not a WE artifact (constellation-layering). Implements the graded gate in two stages: pre-merge first (new-version trigger → security scan → cool-off → severity from the changelog-manifest → auto-test → auto-merge patch/minor-green, human-gate major + visual-diff via the upgrader engine), then post-deploy staged rollout (metrics → auto-rollback). Carries the WE-only edge: pre-test a version against consumers' suites before release via the provider-consumer graph (#092). Blockers #102/#094 resolved.
