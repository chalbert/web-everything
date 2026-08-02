---
bornAs: xhdcb79
kind: story
size: 5
parent: "2612"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, orchestrator-mechanization, drain, ci-lifecycle]
---

# ci:failed on a parked PR must auto-reroute a fix into the author lane

When a parked PR flips to `ci:failed`, the drain must automatically re-dispatch a fix in the author's lane (or file/label it for one) — instead of waiting for the main session to read the CI logs and dispatch a fix by hand.

## The concrete gap — what the main session did by hand tonight

- **PR #975 went `ci:failed`.** Nothing in the drain reacted. The main session had to **read the CI logs by hand, diagnose the failure, and dispatch a fix manually** into the lane.
- A `ci:failed` parked PR is a dead end today: it just sits red until a human notices, interprets the failure, and re-dispatches. The drain watches the PR but does not act on the red-CI transition.

## Why this blocks a session-free conveyor

A session-free conveyor produces PRs faster than a human can babysit them, and CI failures are routine (flakes, merge-base drift, a real regression). If every red PR requires a human to read logs and hand-dispatch a fix, the conveyor stalls the moment CI goes red on any parked couple — which is often. For the conveyor to run with no main-session judgment, a `ci:failed` transition on a parked PR must itself TRIGGER the fix path, not queue up work for a person.

## The mechanical fix

- **Detect the transition.** The drain watches parked PRs and detects when one flips to `ci:failed` (a parked-PR CI-state change, not a fresh open).
- **Auto-re-dispatch into the author lane.** On that transition, the drain automatically re-dispatches a fix in the PR's author lane — reuse the lane→PR machinery the conveyor already has (acquire/resume the author lane, hand the CI failure context to a fix agent). The lane→PR identity is known from the PR's head `lane/*` ref and the lane-ports registry.
- **Fallback: file/label for a fix.** When an author lane can't be re-dispatched directly (lane gone, ambiguous ownership), the drain FILES or LABELS the PR for a fix (a `ci:failed`-owed marker / backlog capture) so the failure is tracked and picked up — never silently left red waiting on the main session.
- Hand the fix agent the actual CI failure context (the failing check + logs) so it diagnoses from the real signal, the way the main session did by hand.

## Cross-references

- **#2820 / label-hold self-consistency** — the review/merge-gate mechanization this sits beside; together they close the "parked PR needs a human" gaps (held, pending-review, and now red-CI).
- The conveyor lane→PR transport (`we:scripts/pr-land.mjs`, `we:scripts/lane-pool.mjs`) and the lane-ports registry (item→lane) are the machinery the auto-re-dispatch reuses.

## Acceptance

- A parked PR that transitions to `ci:failed` triggers an automatic fix re-dispatch in its author lane, with no main session reading logs or dispatching by hand.
- The fix agent receives the actual CI-failure context (failing check + logs), not just a "it's red" signal.
- When direct re-dispatch is impossible, the drain files/labels the PR for a fix (a tracked `ci:failed`-owed marker), never leaving it silently red.
- Regression: reproduce the #975 scenario — a parked PR goes `ci:failed` and a fix is auto-routed into its lane (or filed) without main-session intervention.
