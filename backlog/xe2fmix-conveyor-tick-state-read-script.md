---
kind: story
size: 3
parent: "xkggoo0"
status: open
dateOpened: "2026-07-22"
tags: [conveyor, script]
---

# Conveyor tick state-read script

One script call that returns the whole conveyor tick picture as a single JSON document, so each tick of the /conveyor skill (#xkggoo0) starts from one deterministic read instead of four ad-hoc commands plus eyeballing. Scripted per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](docs/agent/platform-decisions.md#deterministic-core-thin-judgment).

## The one JSON

- **Queue state** — the build queue (buildQueued, blockers, rank order);
- **Lanes + leases** — the lane pool with each lane's lease (session, purpose, scope);
- **In-flight PRs** — state / CI / labels per open lane PR;
- **Daemon status** — the resident drain daemon's `status --json` (plateau:tools/drain-daemon/cli.mjs);
- **Idle-clock inputs** — last queue-add and last merge timestamps (feeds the conveyor's idle-wait stop);
- **Health verdict** — stalled-lane detection via delivery-agent transcript mtimes, reusing the approach in [we:.claude/skills/batch-backlog-items/workflow-progress.mjs](.claude/skills/batch-backlog-items/workflow-progress.mjs).

## Why

Replaces four ad-hoc commands + eyeballing per tick with one reproducible read. The skill's tick loop (#xxa7f8p) consumes it directly, and the future product conveyor's server shells the same script — one implementation, two shells, per the statute's one-source clause.
