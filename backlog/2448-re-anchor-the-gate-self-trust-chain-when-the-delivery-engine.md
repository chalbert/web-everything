---
bornAs: xa6i7k2
kind: task
parent: "2445"
status: resolved
dateOpened: "2026-07-11"
dateStarted: "2026-07-13"
dateResolved: "2026-07-13"
costUsd: 0.86
costSessions: 1
graduatedTo: none
tags: [plateau-loop, review-gate, trust-chain]
---

# Re-anchor the gate-self trust chain when the delivery engine leaves WE

The review:human conflict-of-interest gate keys on literal WE paths — `isGateSelfPath` in [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) matches [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) and itself. The moment the engine is extracted out of WE (the whole point of the parent epic), those checks silently stop matching and a trust-chain edit becomes agent-clearable. Make the trust-chain path set travel with the extraction as explicit config, and design the self-hosting case: the coordinator draining PRs that modify the coordinator.

## Why this is owed on every variant

Surfaced by the 2026-07-11 red team of the parent epic as its most concrete, checkable gap. It applies to
*any* extraction shape — plateau-app module, own repo, or product core — and equally to the de-scoped
phase-1 drain daemon: as soon as the drain logic lives outside `we:scripts/`, a PR editing it no longer
trips `gate-self`, so the "a human clears trust-chain edits" invariant (exercised on PR #423) silently
evaporates.

## What "done" looks like

- The gate-self path set is explicit, versioned config the extraction carries — not literals buried in
  [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) — and it covers the engine's
  new home(s) across repos.
- A regression test proves a PR touching the relocated engine still derives `humanRequired: true`.
- The self-hosting conflict of interest is designed, not assumed: the coordinator must never be the sole
  reviewer-and-lander of a change to itself (the #2285 invariant, one level up).
