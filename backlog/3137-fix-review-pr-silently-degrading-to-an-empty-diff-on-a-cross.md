---
bornAs: xu4j03b
kind: story
size: 3
status: open
dateOpened: "2026-08-16"
tags: [review-pr, operations, security, correctness]
---

# Fix review-pr silently degrading to an empty diff on a cross-repo `--repo=` target

`review-pr`'s `read` step takes `--repo=` as an unvalidated string, but its net-diff git calls (`readPr` in we:scripts/operations/review-pr-io.mjs) are rooted at this checkout's `REPO_ROOT` with no cwd override — unlike `judge`, which honors `JUDGE_LANE_CWD`. Pointed at a PR in another repo, the head ref cannot resolve locally, so `shapeReadFinding` (we:scripts/operations/review-pr.mjs) degrades instead of erroring: `degraded: true`, empty `netChangedFiles`, empty `diffText` — handing the judge an EMPTY diff, a false-pass hazard. Reproduced live against plateau-app#139.

## Where the local-git-only assumption lives

- `readPr({ pr, repo, exec, cwd = REPO_ROOT })` (we:scripts/operations/review-pr-io.mjs) defaults `cwd` to `REPO_ROOT` (`export const REPO_ROOT = resolve(HERE, '..', '..')`, i.e. this web-everything checkout — line 43 as of 2026-08-21, not 40 as first filed) and never checks it against the `repo` argument.
- `const gitExec = exec || execFileIn(cwd)` (we:scripts/operations/review-pr-io.mjs, in `readPr`) bakes that `cwd` into every `git` call `resolveNetDiffBasis`/`computeNetDiffText`/`computeNetDiffPaths` make — there is no per-call override reachable from `--repo=`.
- `createReviewPrReader()` is wired with no `cwd` option at all: `[REVIEW_PR_OP]: () => ({ declaration: reviewPrOperation({ readPr: createReviewPrReader() }) … })` (we:scripts/operations/run.mjs). Contrast the `judge` step in the same file, which DOES accept a lane-cwd override — the wiring is now `makeJudge: createCliJudgeFactory()`, and `createCliJudgeFactory` resolves `cwd: cwd || env.JUDGE_LANE_CWD || null` (the `--cwd` flag first, the env var second, #3151). The card was filed quoting the older `createDefaultJudge({ cwd: process.env.JUDGE_LANE_CWD || null })` spelling; the contrast it draws is unchanged. `read` has no equivalent.
- `shapeReadFinding` (we:scripts/operations/review-pr.mjs) only throws on the `exec-contract` miss (a malformed injected `exec`). The other two misses — `ref-unresolved` and `diff-failed` — DEGRADE by design (see its own doc comment): `netChangedFiles: []`, `diffText: String(diff.text || '')` (empty), `degraded: true`, `degradedReason` set. That degrade path was written for a genuinely-unresolvable ref inside the SAME repo (e.g. a lane branch this clone has not fetched yet); a cross-repo `--repo=` hits the identical path for a completely different reason — the target lives in another repository entirely — and the two are indistinguishable downstream.
- `renderJudgeInput` (we:scripts/operations/review-pr.mjs) then hands the judge `read.diffText?.trim() || '_(the net diff could not be resolved — see the degraded note)_'` — a placeholder sentence, not a hard stop. Nothing in the `read` → `judge` → `reduce` → `confirm` path refuses to proceed on a degraded, cross-repo-caused empty basis.

## Reproduction

Ran `review-pr` (via we:scripts/operations/run.mjs) against `--repo=chalbert/plateau-app --pr=139` from this checkout tonight. `gh pr view` succeeded (it hits the real GitHub API, not scoped to the local clone), so the run proceeded past the `read` step, but the net-diff git calls — rooted at this repo's `REPO_ROOT` — could not resolve plateau-app's head ref locally. The result: `degraded: true`, `degradedReason: "ref-unresolved"`, `netChangedFiles: []`, `diffText: ""`. The judge subprocess received an effectively empty diff and no error surfaced anywhere in the console output or the run record — the run reads as a normal, if slightly degraded, review.

## Why this is a security-relevant false-pass hazard

An empty (or near-empty) diff handed to a judge juror very plausibly comes back as a trivial/vacuous accept — there is nothing to find fault with in nothing. That means a genuinely bad cross-repo PR can get waved through by `review-pr` with a clean-looking verdict, while no human or agent ever actually saw its content. The degrade path exists to keep an operation limping through a locally-unresolvable-but-legitimate case; it was never meant to silently substitute for "this target is not even the right repository."

## Fix direction

**(a) Recommended near-term fix — refuse loudly on a repo mismatch.** Make `review-pr` compare `--repo=` against this checkout's own remote (e.g. `origin`'s `owner/name`) before doing any net-diff work, and hard-error if they differ, instead of falling through to `readPr`'s local git calls. This is the smallest, safest change: it removes the false-pass hazard entirely and pushes any genuine cross-repo review back to the manual process used for plateau-app#139 tonight. It costs nothing for the overwhelmingly common same-repo case.

**(b) Real fix, if cross-repo `review-pr` support is wanted later — accept a lane-cwd override for `read`, mirroring `judge`.** Thread a `cwd` (or `REVIEW_PR_LANE_CWD`-style env var) through `createReviewPrReader`/`readPr` the same way we:scripts/operations/run.mjs already threads `JUDGE_LANE_CWD` into `createDefaultJudge`, so a caller reviewing a PR in another repo can point `read` at an actual checkout of that repo. This is the properly general fix but is more work and needs its own care around lane isolation (the same concern `assertLaneCwd` exists for on the `judge` side).

Filing this as the safe (a) fix by default; (b) is the escalation path if cross-repo review-pr support becomes a real requirement. This is a real correctness/security gap in the review tooling's own trust boundary — a reviewer that can be made to see nothing and still report "accepted" — so it should not sit at low priority.

## Design

Build **(a)**. It is small, it removes the hazard outright, and it does not foreclose (b).

**The comparison helper already exists — do not add yet another `git remote get-url` parse.** `originSlugOf(cwd)`
in we:scripts/conveyor/infra-blocked.mjs runs `git remote get-url origin`, matches
`/[:/]([^/]+\/[^/]+?)(?:\.git)?$/`, and returns `owner/name` or `null`. The pattern is already duplicated well
past "a second copy" — inline copies live in we:scripts/merge-ai-prs.mjs, we:scripts/backlog.mjs,
we:scripts/lane-resume.mjs, we:scripts/pr-land.mjs, we:scripts/lane-pool.mjs (twice) and
we:scripts/readiness/scope-lease-collect.mjs. Reuse `originSlugOf`; do not add the eighth.

**`originSlugOf` is not injectable today, and that is the one real obstacle to the tier-1 tests below.** It
calls `execFileSync` directly and takes no `exec`. Meanwhile `readPr` routes *every* git call through the
injected `exec` its own header documents as the exec contract, and the ~30 existing tests in
we:scripts/operations/__tests__/review-pr-io.test.mjs are all pure-stub — none stands up a real temporary git
checkout. So the build must **add an optional injected `exec` to `originSlugOf`** (defaulting to the current
`execFileSync`, so every existing caller is byte-identical) and have `readPr` pass its own `gitExec`. That
keeps one parser, keeps `readPr` fully stubbable, and is a smaller change than either standing up real
checkouts in the suite or copying the regex.

**Where the refusal goes, and why not deeper.** Put it in `readPr` (we:scripts/operations/review-pr-io.mjs),
beside the two type guards it already has on `pr` and `repo`, and **throw** — do not return a degraded finding.
That placement matters for two reasons:

1. `readPr` is where `cwd` defaults to `REPO_ROOT`, so it is the exact function whose assumption is being
   violated. `createReviewPrReader({ cwd })` already threads a `cwd` through, so the check should compare
   `repo` against the origin of *that* `cwd`, not a module constant — which makes (b) a pure widening later
   (pass a real sibling checkout as `cwd` and the same check passes) rather than a rewrite.
2. Throwing keeps it out of `shapeReadFinding`'s degrade path. That function's contract is deliberate:
   `exec-contract` throws, `ref-unresolved` and `diff-failed` degrade. A repo mismatch is neither — it is a
   caller error known *before* any git runs, and it must be indistinguishable from `exec-contract` in
   consequence: refuse, do not review.

**Fail open on an unreadable origin, closed on a real mismatch.** `originSlugOf` returns `null` when there is no
`origin` (a detached tree, a fresh clone). Treat `null` as "cannot tell" and proceed — the pre-existing degrade
path still covers a genuinely unresolvable ref, and hard-failing there would break every checkout without an
`origin` remote for a hazard that is not present. Only a *known, different* slug refuses.

**The message must name the real cause.** Today the operator sees `degradedReason: "ref-unresolved"`, which
reads as a transient fetch miss. The refusal should say the target lives in another repository, name both slugs,
and point at the manual route — that is the entire difference between the two failure modes the card says are
"indistinguishable downstream".

**Do not touch `judge`.** we:scripts/operations/run.mjs threads `--cwd` / `$JUDGE_LANE_CWD` into
`createDefaultJudge`, and `assertLaneCwd` guards it. That is the (b)-shaped machinery; this item leaves it
alone and only cites it as the pattern to mirror if (b) is ever built.

## Done when

- **Tier 1** — a test in we:scripts/operations/__tests__/review-pr-io.test.mjs asserts `readPr` **throws** when
  the `repo` argument does not match the origin slug of its `cwd`, and that the error text names both slugs.
  It fails on today's code, which proceeds into `resolveNetDiffBasis` and returns a degraded finding.
- **Tier 1** — a test pins the fail-open arm: with an origin that cannot be read (`originSlugOf` → `null`),
  `readPr` proceeds exactly as before. Without this the fix breaks every checkout with no `origin` remote.
- **Tier 1** — a test pins the boundary against the existing degrade path: a **same-repo** target whose head ref
  does not resolve locally still degrades (`degraded: true`, `degradedReason: 'ref-unresolved'`) and does NOT
  throw. The two failure modes must end up distinguishable, which is the whole point of the item.
- **Tier 2** — no new origin parser: `grep -rn "remote', 'get-url'" we:scripts/` shows no *additional* call
  site beyond the seven that exist today; the review path imports `originSlugOf` from
  we:scripts/conveyor/infra-blocked.mjs, and `originSlugOf` gained an optional injected `exec` whose default
  leaves every existing caller unchanged.
- **Tier 3** — `shapeReadFinding` (we:scripts/operations/review-pr.mjs) is unchanged in its degrade contract:
  read it and confirm `ref-unresolved` / `diff-failed` still degrade and only `exec-contract` throws. The new
  refusal lives strictly upstream of it.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: check by mutation or reversion ahead of the build) — The card backs its claim with a live reproduction against plateau-app#139, and static reading of we:scripts/merge-ai-prs.mjs's resolveNetDiffBasis (returns reason:'ref-unresolved' when neither candidate resolves) plus we:scripts/operations/review-pr.mjs's shapeReadFinding (throws only on 'exec-contract', degrades on 'ref-unresolved'/'diff-failed') confirms the mechanism is real, not assumed.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — readPr/createReviewPrReader has exactly one production ES-import consumer, we:scripts/operations/run.mjs:69 (`createReviewPrReader()`, no cwd); no subprocess/hook caller invokes readPr independently. The header of we:scripts/operations/run.mjs carries a `--cwd=<a lane>` example that sits on the same line as `--repo=`, which could mislead an operator into thinking it reaches read, but tracing the code (we:scripts/operations/run.mjs — `createCliJudgeFactory` and the `makeJudge: createCliJudgeFactory()` call site) confirms --cwd/JUDGE_LANE_CWD wires only into the judge step's spawn, never into readPr — so no hidden second channel already reaches the function this card is fixing.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The Done-when Tier-1 criteria explicitly require a test that fails on today's code, a second pinning the fail-open (null-origin) branch, and a third pinning that the pre-existing same-repo degrade path still does NOT throw — that is a mutate-and-require-a-named-test discipline applied at design time, not left for the builder to invent.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — This is the risk the card exists to fix: today's failure is silent (degraded:true buried in a run record, no console error), and the design's refusal throws a message that must name both slugs (Done-when) — turning a silent false-pass into a surfaced, actionable error.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card grounds the hazard in one concrete live reproduction rather than a hypothetical, and deliberately scopes to the smallest safe fix (a), explicitly deferring the larger lane-cwd-override design (b) until cross-repo review-pr support is an actual requirement — it does not oversize the work relative to demonstrated need.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The design reuses `originSlugOf` (we:scripts/conveyor/infra-blocked.mjs:416-424), which always shells a REAL, un-mockable `git remote get-url origin` and takes no injectable exec — unlike every other git call inside readPr, which is carefully routed through the injected `exec` the module's own header documents as 'THE exec CONTRACT'. The card's Tier-1 tests don't say how the three cases (mismatch throws, null-origin fails open, same-repo still degrades) get driven without either a real temporary git checkout — a pattern not used anywhere else in we:scripts/operations/__tests__/review-pr-io.test.mjs, whose existing ~30 tests are all pure-stub — or a small extension to originSlugOf to accept an injected exec.

**Corrections applied by this review:**

- REPO_ROOT is defined at we:scripts/operations/review-pr-io.mjs:43 (`export const REPO_ROOT = resolve(HERE, '..', '..');`), not line 40 as the card states.
- The card's quoted judge wiring `judge: createDefaultJudge({ cwd: process.env.JUDGE_LANE_CWD || null })` doesn't match the live code — the actual wiring is `makeJudge: createCliJudgeFactory()` (we:scripts/operations/run.mjs:263), which resolves cwd from a `--cwd` flag first and `$JUDGE_LANE_CWD` second (we:scripts/operations/run.mjs:181-186); the substantive contrast the card draws (read has no reachable override, judge does) still holds under the more accurate reading.
- The card frames reusing originSlugOf as avoiding writing 'a fourth' git-remote-slug parser, but the pattern is already duplicated well beyond that — at least six more inline copies exist (we:scripts/backlog.mjs:253, we:scripts/lane-resume.mjs:94, we:scripts/pr-land.mjs:830, we:scripts/lane-pool.mjs:143 and :290, we:scripts/readiness/scope-lease-collect.mjs:448, plus we:scripts/merge-ai-prs.mjs:2561) — an undercount that doesn't change the soundness of the card's own decision to reuse originSlugOf rather than add another copy.

The card's diagnosis and fix direction are accurate against the live repo — readPr defaults cwd to REPO_ROOT with no override reachable from --repo=, the judge step's --cwd/JUDGE_LANE_CWD is confirmed to reach only the juror spawn and never read, shapeReadFinding's throw-vs-degrade split is exactly as described, originSlugOf exists and behaves as cited, and readPr has exactly one production consumer — so the design is sound and minimally scoped, with one real but non-blocking testability gap around reusing a non-injectable git call inside an otherwise strictly exec-injected function.

_Recorded through the declared `review-prep` operation._

**Driver disposition (2026-08-21).** All four points accepted and applied, each re-verified against the tree.
The **interface/testability** finding was the substantive one and changes the build: `originSlugOf` shells
`execFileSync` with no injectable `exec`, while `readPr` routes every git call through its injected `exec` and
the whole of we:scripts/operations/__tests__/review-pr-io.test.mjs is pure-stub — so the Design now requires
adding an optional injected `exec` to `originSlugOf` (default unchanged) rather than leaving the three tier-1
tests with no way to run. The three citation corrections are applied in the body: `REPO_ROOT` is at line 43 not
40; the judge wiring is `makeJudge: createCliJudgeFactory()` resolving `cwd || env.JUDGE_LANE_CWD || null`
(#3151), not the older `createDefaultJudge({...})` spelling the card quoted; and the duplicate-parser count is
seven-plus, not three, which strengthens rather than weakens the decision to reuse.
