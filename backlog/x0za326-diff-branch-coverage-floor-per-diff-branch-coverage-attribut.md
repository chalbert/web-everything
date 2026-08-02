---
kind: story
size: 3
parent: "xk8w1ep"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, self-approval, spec-first]
---

# Diff-branch-coverage floor — per-diff branch coverage attribution as a self-approval gate

Add per-diff branch-coverage attribution as the first, cheapest mechanical gate in the spec-first floor: a change to the in-scope tier must exercise the branches it introduces or touches, measured **on the diff**, not on the whole repo. This **raises the floor**; it does not prove the impl meets the spec (that phrasing is retired epic-wide — coverage measures execution, not assertion).

## Gap

The repo has whole-repo v8 coverage with an 80% threshold on lines/functions/branches/statements ([we:vitest.config.ts](vitest.config.ts), `provider: 'v8'`, `thresholds`), but **no per-diff attribution**: a PR can add an untested branch and still pass because the repo-wide average stays above 80%. So today there is no mechanical signal that *the branches this diff added* were run.

## Why

Spec-first self-approval leans on a mechanical floor. The floor's cheapest, always-on layer is "did the new branches actually execute under the ratified tests." Without per-diff attribution the floor has a hole exactly where a self-approved change lands new code.

## Mechanical approach

- Compute branch coverage attributed to the diff — the changed/added lines in the in-scope file set (tier predicate defined in slice 4) — from the existing v8 coverage output, and fail below a stated per-diff floor.
- Wire it as a `check:standards` / CI gate distinct from the existing whole-repo 80% threshold (keep both; this one is diff-scoped).
- Language discipline: report it as "branches introduced by this diff were exercised," never "the impl is correct."

## Non-goals

Mutation testing (slice 3 closes the execution-≠-assertion gap) and the probe-runner (slice 2) are separate. This slice only attributes existing v8 coverage to the diff.
