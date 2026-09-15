---
bornAs: xsxz3lk
kind: story
size: 3
parent: "2873"
status: active
dateOpened: "2026-08-02"
dateStarted: "2026-09-15"
tags: [conveyor, self-approval, spec-first]
scope:
  - we:scripts/lib/
  - we:vitest.config.ts
scopeRationale: "isTrustChainTier's target file (new vs. added to an existing lib file) isn't named by the story; scoped to the directory until the build PR picks one."
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

## Progress

- [x] **Predicate** — [we:scripts/lib/trust-chain-tier.mjs](scripts/lib/trust-chain-tier.mjs) exports `isTrustChainTier(path)`, `TRUST_CHAIN_TIER_FILES`, and `normalizeTierPath`. The tier is **derived** from the `TRUST_CHAIN` roster in [we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs): every roster home under [we:scripts/lib/](scripts/lib/) that is JS source (so no JSON contract, no test suite), plus [we:scripts/lib/disposition-judge.mjs](scripts/lib/disposition-judge.mjs), which the epic names but the escalation roster does not register. The match is on the exact normalized repo-relative path, not the basename, because coverage globs and mutation lists need concrete files (unlike `isTrustChainPath`, which escalates by basename). Accepts the `we:` prefix, a leading `./`, backslashes, and dot segments. Rejects other loci, absolute paths, paths that climb above the repo root, same-basename files in other folders, and test files.
- [x] **Instrumentation** — [we:vitest.config.ts#coverage](vitest.config.ts) spreads `TRUST_CHAIN_TIER_FILES` into `coverage.include` as exact paths (no glob over the scripts plane). The #2082 comment now describes the exception. No tier-specific threshold was added.
- [x] **Honest starting scope** — before this change these files had 0% measured. First measurement from the scripts/lib unit suites (lines / branches / functions %): auto-land-seam 97.9/73.7/62.5, disposition-judge 100/93.5/100, disposition-land-seam 100/88.9/100, gate-config 100/95/100, review-core 100/90.5/97.9, review-escalation 94.1/91.8/76, review-independence 100/98.2/100, review-policy 95.1/69.7/100, review-runner-core 97.3/52.9/80. Some files fall below 80% on branches or functions. They now count toward the combined 80% bar, but they don't have a bar of their own. #2876 owns the per-diff floor.
- [x] **Tests** — [we:scripts/lib/__tests__/trust-chain-tier.test.mjs](scripts/lib/__tests__/trust-chain-tier.test.mjs) pins the tier membership, checks every tier file exists on disk, checks the tier is derived from the roster, and covers the normalization edge cases. It also imports the real [we:vitest.config.ts](vitest.config.ts) to confirm `coverage.include` has every tier file and no other entries from the scripts plane.
