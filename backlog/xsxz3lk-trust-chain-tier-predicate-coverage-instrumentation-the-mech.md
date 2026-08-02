---
kind: story
size: 3
parent: "xk8w1ep"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, self-approval, spec-first]
---

# Trust-chain tier predicate + coverage instrumentation — the mechanical in-scope definition everything else depends on

Define, in ONE place and FIRST, the two things every downstream slice references: (a) the mechanical **`isTrustChainTier(path)` predicate** that decides which files are in scope, and (b) the **coverage instrumentation** for that tier — adding the trust-chain files to `coverage.include` so anything is measured on them at all. This was originally split into slice 4 (the predicate) with the coverage premise left implicit; both are pulled forward here so no earlier slice forward-references a definition that ships later.

## Gap

1. **The tier predicate did not exist yet, but earlier slices used it.** The diff-branch-coverage floor and the mutation slice both scope themselves to "the in-scope file set" — a set that only a predicate can name. With the predicate defined last (old slice 4), those slices forward-referenced a thing that shipped three slices later.
2. **The trust-chain tier is NOT instrumented today.** `coverage.include` in [we:vitest.config.ts#coverage](vitest.config.ts) is a **curated allowlist of standards/impl planes** (`blocks/`, `capabilities/`, … `functions/`). Its own comment (~L29-35) says it **deliberately EXCLUDES** `demos/`, `src/`, and **`tools/` + `scripts/` (build tooling, mostly `.mjs`)**. So the trust-chain files this epic targets — [we:scripts/lib/disposition-judge.mjs](scripts/lib/disposition-judge.mjs), [we:scripts/lib/review-core.mjs](scripts/lib/review-core.mjs), and the rest under [we:scripts/lib/](scripts/lib/) — are **not instrumented at all**, and the 80% bar is the **#2082 scoped-planes bar** (measured 85% across that set), NOT a repo-wide bar. Per-diff attribution (the next slice) can measure nothing on a tier v8 never instruments.

## Mechanical approach

- **`isTrustChainTier(path)` predicate.** A pure function — like #2840's `isDeclarativeLeashPath` or a policy-core basename set — over the `disposition-judge` / `review-core` / engine file set under [we:scripts/lib/](scripts/lib/). The runner decides tier by this predicate, never by judgment. This is the single definition every other slice imports.
- **Add the trust-chain tier to `coverage.include`.** Extend the [we:vitest.config.ts#coverage](vitest.config.ts) allowlist so the in-scope [we:scripts/lib/](scripts/lib/) trust-chain files are instrumented, and state the real starting scope honestly (they begin at 0% instrumented, not "already at 80%"). Keep the #2082 scoped-planes comment in lockstep. This is a **hard prerequisite** for the diff-branch-coverage floor.

## Non-goals

Per-diff attribution (next slice), the probe-runner, mutation, and the ratification default are all separate. This slice only defines the predicate and turns instrumentation ON for the tier — it adds no new gate threshold of its own.
