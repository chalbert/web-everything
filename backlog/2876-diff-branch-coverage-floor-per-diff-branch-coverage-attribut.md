---
bornAs: x0za326
kind: story
size: 3
parent: "2873"
status: open
blockedBy: ["2875"]
dateOpened: "2026-08-02"
tags: [conveyor, self-approval, spec-first]
---

# Diff-branch-coverage floor — per-diff branch coverage attribution as a self-approval gate

Add per-diff branch-coverage attribution as the first, cheapest mechanical gate in the spec-first floor: a change to the in-scope tier must exercise the branches it introduces or touches, measured **on the diff**, not on the whole repo. This **raises the floor**; it does not prove the impl meets the spec (that phrasing is retired epic-wide — coverage measures execution, not assertion).

## Gap

The repo's v8 coverage is **NOT whole-repo, and does NOT cover this epic's tier.** `coverage.include` in [we:vitest.config.ts#coverage](vitest.config.ts) is a **curated allowlist of standards/impl planes** — `blocks/**/*.ts`, `capabilities/**/*.ts`, … through `functions/**/*.ts`. Its own comment (~L29-35) states the 80% bar is the **#2082 scoped-planes bar** (measured 85% across that set) and that it **deliberately EXCLUDES** `demos/`, `src/`, and **`tools/` + `scripts/` (build tooling, mostly `.mjs`)**. So the trust-chain files this epic targets — [we:scripts/lib/disposition-judge.mjs](scripts/lib/disposition-judge.mjs), [we:scripts/lib/review-core.mjs](scripts/lib/review-core.mjs), and the rest under [we:scripts/lib/](scripts/lib/) — are **not instrumented at all**; the 80% threshold never sees them. On top of that there is **no per-diff attribution**: even within the instrumented planes, a PR can add an untested branch and still pass because the scoped-planes average stays above 80%. So today there is no mechanical signal that *the branches this diff added* to the trust-chain tier were run.

## Prerequisite (hard dependency)

Per-diff attribution measures nothing on a tier v8 never instruments. So the first slice ([#2875](2875-trust-chain-tier-predicate-coverage-instrumentation-the-mech.md), this item's `blockedBy`) MUST first (a) define the `isTrustChainTier(path)` predicate and (b) **add the trust-chain tier to `coverage.include`** so v8 emits coverage for those files. Only then can this slice attribute that coverage to the diff. This item does NOT re-derive the tier or re-edit the allowlist; it consumes both from #2875.

## Why

Spec-first self-approval leans on a mechanical floor. The floor's cheapest, always-on layer is "did the new branches actually execute under the ratified tests." Without per-diff attribution the floor has a hole exactly where a self-approved change lands new code.

## Mechanical approach

- Compute branch coverage attributed to the diff — the changed/added lines in the in-scope file set (the `isTrustChainTier` predicate from [#2875](2875-trust-chain-tier-predicate-coverage-instrumentation-the-mech.md)) — from the v8 coverage output (now emitted for the tier per the prerequisite), and fail below a stated per-diff floor.
- Wire it as a `check:standards` / CI gate distinct from the existing scoped-planes 80% threshold (keep both; that one is a plane-wide average, this one is diff-scoped to the trust-chain tier).
- Language discipline: report it as "branches introduced by this diff were exercised," never "the impl is correct."

## Non-goals

Mutation testing ([#2878](2878-mutation-testing-on-the-trust-chain-tier-stryker-vitest-scop.md) closes the execution-≠-assertion gap) and the probe-runner ([#2877](2877-probe-runner-and-commit-the-probe-as-test-adversarial-reprod.md)) are separate. This slice only attributes tier v8 coverage to the diff; defining the tier and turning its instrumentation on belong to [#2875](2875-trust-chain-tier-predicate-coverage-instrumentation-the-mech.md).
