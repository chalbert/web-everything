---
type: decision
workItem: story
size: 5
parent: "099"
status: open
blockedBy: ["102", "094"]
dateOpened: "2026-06-06"
tags: [auto-update, evergreen, change-management, dependencies, risk-analysis, phased-rollout, reversion, pre-test, monitoring, ci]
relatedReport: reports/2026-06-06-front-end-platform-book.md
relatedProject: webreliability
crossRef: { url: /backlog/099-evergreen-app-vision/, label: "Evergreen app (#099)" }
---

# Auto-update pipeline — keep an app on the latest deps/standards safely, with risk gates and reversion

Define the **update orchestration** that lets an app stay current automatically: when a new version of a dependency (third-party or internal) or a Platform standard is available, run a controlled pipeline — security analysis → cool-off buffer → auto-branch + auto-test → gates → merge/deploy → monitor → revert if needed. This is the *change-management* engine of the evergreen app ([#099](/backlog/099-evergreen-app-vision/)); the essay describes it across its *Auto-update*, *Change management*, *Pre-testing*, and *Monitoring* sections. Distinct from the **upgraders** (#094, which transform code) — this is the *policy + workflow* that decides when an update runs and how it's made safe.

## The pipeline (from the essay)

1. **Trigger** — a new dep/standard version is published.
2. **Security analysis** — scan the new version before anything else.
3. **Cool-off / buffer period** — a configurable wait before adopting new tech (avoid chasing every whim).
4. **Auto-branch + auto-test** — apply the update in a branch, run the full suite; if breaking changes exist, the dep's shipped **migration scripts** (#094) + the **changelog manifest** (#102) drive automatic codemods.
5. **Risk analysis from the changelog** — classify the update (major/minor/patch) and route accordingly; **approval required for visual diffs and high-risk updates**, auto-merge for low-risk green ones.
6. **Phased rollout + reversion protocol** — staged deploy, automated rollback on regression.
7. **Monitoring** — track functional/visual regression in prod continuously; failed auto-updates are tagged for human intervention with configurable criteria.

## Pre-testing (the platform's edge)

A **Platform-side** update can be **pre-tested against its consumers' suites before it is even released**, so its compatibility is known up front — the introspectable relationship graph (#092) supplies *which* apps to pre-test. This is the difference between "hope the bump is safe" and "we already proved it against your build."

## Open questions

- Where does this live: a **protocol** (an "auto-update conformance" contract an app/lib declares it supports) vs. a **Plateau service** (the orchestration that runs it)? Recommendation: a thin protocol for *declaring* update policy + capability, with the orchestration as a Plateau offering (ties #092/#089 idea 1).
- Gate model: what's auto-merge vs. human-gated by default (visual diff and major = human; patch/minor green = auto). Make it configurable policy, not hardcoded.
- Strong dependency on machine-readable change descriptors (#102) and shipped migration scripts (#094); sequence those first.
