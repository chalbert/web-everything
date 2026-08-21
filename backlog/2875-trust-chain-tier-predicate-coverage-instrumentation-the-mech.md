---
bornAs: xsxz3lk
kind: story
size: 3
parent: "2873"
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

## Design

### Gap 1 is already closed — do NOT build a second predicate (grounded 2026-08-21)

The predicate exists. [we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs) already ships the whole
mechanism the Gap section says is missing:

- `TRUST_CHAIN` (`:99`) — the versioned roster, **22 members** today, each `{ role, file, tier, leash?, desc, homes[] }`.
- `TRUST_CHAIN_BASENAMES` (`:335`) — the frozen derived matcher input.
- `isTrustChainPath(path)` (`:394`) — the pure basename predicate, already the single definition the escalation
  callers import. It is imported **unaliased** by
  [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) (`:16`) and used directly at `:558`.
  *(Correction, 2026-08-21: an earlier draft of this section said `isTrustChainPath` is re-exported there as
  `isGateSelfPath` / `isDeclarativeLeashPath`. It is not — those two alias the NARROWER policy-tier predicates
  `isPolicyCorePath` (`we:scripts/lib/gate-config.mjs:404`) and `isPolicySpecPath` (`:414`). Three different
  predicates over the same roster; do not treat them as interchangeable when picking the coverage set.)*

So **build no new `isTrustChainTier`**. A second predicate over the same roster is exactly the
duplicate-definition drift this slice exists to prevent; if a downstream slice wants that name, alias it
(`export const isTrustChainTier = isTrustChainPath`) rather than re-derive membership. Correction to Gap 1:
earlier slices were not forward-referencing a non-existent predicate — they were forward-referencing a
*coverage* premise, which is Gap 2.

### Gap 2 is real — the tier is genuinely uninstrumented

Verified: `coverage.include` in [we:vitest.config.ts](vitest.config.ts) (`:36-66`) is a curated allowlist of
**28 standards/impl planes**, all `<plane>/**/*.ts`. Its comment (`:28-35`) states the exclusion in so many
words — *"Deliberately EXCLUDED (own gates, not this rule): demos/ …, src/ …, tools/ + scripts/ (build tooling,
mostly .mjs)"*. So every trust-chain home under `we:scripts/` is uninstrumented, and the 85% figure that comment
quotes is the #2082 scoped-planes measurement, not a bar this tier has ever been held to.

### What to actually build

1. **A derived glob list, from the roster's `homes` — never a hand-typed second list.** `isTrustChainPath` is
   *basename*-keyed (so a member travels when the engine is extracted); `coverage.include` needs **paths**. The
   bridge is `homes`, which every one of the 22 members carries (verified: zero members lack it). Add one
   derived export beside the existing frozen sets:

   ```js
   // we:scripts/lib/gate-config.mjs
   /** The WE-local, instrumentable trust-chain homes — the coverage.include input. Frozen.
    *  Filters `homes` to this repo only (drops the `plateau-app/…` engine homes) and to source
    *  only (drops `__tests__/` suites and `.json` contracts, which are not instrumentable code). */
   export const TRUST_CHAIN_COVERAGE_GLOBS = Object.freeze([/* derived from TRUST_CHAIN */]);
   ```

   `we:vitest.config.ts` then imports it and spreads it into `coverage.include`. Two readers of one roster,
   never two rosters.

2. **The `homes` filter is load-bearing, not cosmetic.** Of the 22 members: **3 live in `plateau-app/`**
   (the `tools/drain-daemon/` daemon, cli and lib) and are not files this repo's vitest can instrument;
   **2 are `.json` contracts**; **3 are `__tests__/` suites**. The remaining ~14 `we:scripts/**` `.mjs` files
   are the instrumentable set. State that count honestly in the config comment rather than implying the whole
   roster is covered.

3. **State the real starting number — measure it, do not assert it.** The card is right that it must not be
   presented as "already at 80%". It will also not be 0% once instrumented, because these files DO have suites
   ([we:scripts/lib/__tests__/](scripts/lib/__tests__/) holds `we:scripts/lib/__tests__/review-core.test.mjs`,
   `we:scripts/lib/__tests__/review-escalation.test.mjs`, `we:scripts/lib/__tests__/gate-config.test.mjs`,
   `we:scripts/lib/__tests__/disposition-judge.test.mjs`, and others). 0% is the *instrumentation* state, not the
   expected *coverage* number. Run the report once and write the measured figure into the comment.

### The threshold is the real risk, and it is unmeasured (juror finding, 2026-08-21)

`coverage.include` is not just a reporting list — the same `coverage` block in
[we:vitest.config.ts](vitest.config.ts) carries `thresholds: { lines: 80, functions: 80, branches: 80,
statements: 80 }` (`:80-85`), and that aggregate gates the required CI `test` check. Widening `include`
therefore **moves the bar's denominator**, and two of the WE trust-chain homes —
`we:scripts/converge-daemon-pass.mjs` and `we:scripts/converge-daemon-install.mjs` — have no test suite at
all. If the merged aggregate drops any of the four metrics under 80, the required check goes red on the
landing PR and stays red on `main`.

This is the single highest-risk part of the slice and the card previously did not name it. **Measure the
merged aggregate BEFORE widening** (run the coverage report with the candidate include list), and if it
lands under the bar, say which of the three exits is taken: backfill the uncovered homes, exclude the
uncoverable ones with a stated reason, or move the trust-chain tier to its own scoped threshold rather than
folding it into the repo-wide aggregate. Do not discover this at CI.

### The sequencing fact that will bite the builder

`we:scripts/lib/gate-config.mjs` is itself `tier: 'policy'`, `leash: 'spec'`, and is pinned in
`RATIFIED_POLICY_SPEC_FLOOR` (`:355`). So **any edit to it forces `review:human`** via `isDeclarativeLeashPath` —
this slice's PR cannot be cleared by an agent panel. That is correct and expected (the parent epic #2873 says
the same of itself), but plan for it rather than discovering it at the drain. If the human round is unwanted for
a pure-derivation addition, the alternative is a **new** small module (e.g.
`we:scripts/lib/trust-chain-coverage.mjs`) that *imports* `TRUST_CHAIN` and derives the globs without editing
`we:scripts/lib/gate-config.mjs`. Both are legitimate; pick deliberately and say which.

### One roster observation, not a licence to edit

The Gap section names [we:scripts/lib/disposition-judge.mjs](scripts/lib/disposition-judge.mjs) as a
trust-chain file. It is **not** in `TRUST_CHAIN` today (checked all 22 `homes`). Either it belongs and the
roster is missing it — a roster edit, human-gated, arguably its own item — or the example is simply wrong. Do
not silently add it under this slice.

## Done when

- `npx vitest run` against [we:scripts/lib/__tests__/gate-config.test.mjs](scripts/lib/__tests__/gate-config.test.mjs)
  is green with new cases that (a) assert the derived glob export exists and every entry resolves to a file that
  exists on disk, and (b) pin the derivation rules — no `plateau-app/` home, no `__tests__/` home, no `.json`
  home — and (c) prove the list is DERIVED, i.e. a synthetic roster member with a `we:scripts/` home changes the
  output. All of these fail on `main` today: the export does not exist.
- `npx vitest run --coverage` produces a v8 report whose `we:coverage/coverage-final.json` contains at least one key
  matching `we:scripts/lib/review-core.mjs`. On `main` today it contains none, because `coverage.include` never
  names `scripts/`. One cheap check: count the keys of
  `we:coverage/coverage-final.json` whose path contains `scripts/lib/` — `0` before, `> 0` after.
- No second membership predicate is introduced: `grep -rn "isTrustChainTier" scripts/` (run inside `we:`) returns
  either nothing or only an alias line assigning `isTrustChainPath` — never a fresh basename or path list.
- `node we:scripts/check-standards.mjs` → 0 errors (the `gate-invariants` and `check-standards.conformance`
  suites both read this roster, so a malformed derived export surfaces there).
- The `we:vitest.config.ts` coverage comment names the trust-chain tier, the count of instrumented homes, and the
  MEASURED starting percentage — reviewable by reading those lines, not by re-deriving them.
- **The required CI `test` check is still green after the widening** — i.e. `npx vitest run --coverage` reports
  all four `thresholds` metrics (lines / functions / branches / statements) at or above 80 with the trust-chain
  homes folded in. This is the criterion most likely to fail: the aggregate denominator moves, and
  `we:scripts/converge-daemon-pass.mjs` / `we:scripts/converge-daemon-install.mjs` start at zero coverage. If it
  does fail, the card records which exit was taken (backfill / stated exclusion / a tier-scoped threshold) —
  never a silent lowering of the bar.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: prove the premise by mutation or reversion first) — The card's own investigation reverses its stated Gap 1 (built a mutation-style check on the claim 'no predicate exists') and finds isTrustChainPath already at we:scripts/lib/gate-config.mjs:394 — a textbook premise-verification-before-building, matching the taxonomy's evidence pattern exactly.
- **blast-radius** (NOT addressed; strategy: measure against the real corpus before wiring) — Adding the ~14 trust-chain .mjs homes to we:vitest.config.ts's `coverage.include` (currently 28 planes, verified) folds them into the SAME aggregate that backs the four 80% thresholds (we:vitest.config.ts:80-85) enforced by the REQUIRED `test` CI job (we:.github/workflows/ci.yml, 'applies the 80% bar to the COMBINED result'). Two of the 14 homes — we:scripts/converge-daemon-pass.mjs and we:scripts/converge-daemon-install.mjs (691 combined lines) — have no `__tests__` file at all (verified by search), i.e. start at 0%. The card measures the STARTING percentage for the new files (Design point 3) but never measures whether the MERGED aggregate still clears the existing 80% floor, and the Done-when only checks that new coverage keys appear, not that the threshold still passes.
- **population** (addressed; strategy: name the population each threshold guards) — The card explicitly refuses to assert 'already at 80%' and insists the real measured figure be written into the comment, and correctly separates the #2082 scoped-planes bar from a repo-wide one — the population-naming discipline the taxonomy asks for is present for the STARTING number; the gap is narrower (see blast-radius above): it doesn't extend that discipline to the threshold's PASS/FAIL outcome once populations merge.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when explicitly requires a synthetic roster member with a we:scripts/ home to change the derived export's output — a real mutation-style proof the derivation isn't hand-typed/decorative, not just a same-length-array check.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — No other consumer of `coverage.include` or of a `TRUST_CHAIN_COVERAGE_GLOBS`-shaped export exists today (checked we:scripts/check-standards-rules.mjs and repo-wide for 'vitest.config' references) — the single named consumer (we:vitest.config.ts) is the only real one.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The seam between the derived export and we:vitest.config.ts is round-trip tested by the Done-when's 'every entry resolves to a file that exists on disk' requirement.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card measures rather than asserts throughout the predicate work (member counts, homes breakdown, existing-suite inventory) before sizing the change.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when's 'count scripts/lib/ keys in we:coverage/coverage-final.json: 0 before, >0 after' is a concrete, non-silent surfacing check for the instrumentation half.

**Corrections applied by this review:**

- The Design section's claim that isTrustChainPath is 're-exported through we:scripts/lib/review-escalation.mjs as isGateSelfPath / isDeclarativeLeashPath' is incorrect — those two aliases re-export isPolicyCorePath/isPolicySpecPath (narrower, policy-tier-only predicates, we:scripts/lib/gate-config.mjs:404,414), not isTrustChainPath; isTrustChainPath itself is used directly and unaliased at we:scripts/lib/review-escalation.mjs:558.

The predicate/premise work is exceptionally well-verified against the live repo (member count, homes-filter breakdown, line citations, and the "gap 1 already closed" correction all check out), but the card never measures whether folding the trust-chain files into the same `coverage.include` array that backs the required CI aggregate threshold is safe, and one internal citation (the re-export aliasing claim) is factually wrong.

_Recorded through the declared `review-prep` operation._
