---
kind: story
size: 3
status: open
dateOpened: "2026-08-16"
tags: [review-pr, operations, security, correctness]
---

# Fix review-pr silently degrading to an empty diff on a cross-repo `--repo=` target

`review-pr`'s `read` step takes `--repo=` as an unvalidated string, but its net-diff git calls (`readPr` in we:scripts/operations/review-pr-io.mjs) are rooted at this checkout's `REPO_ROOT` with no cwd override — unlike `judge`, which honors `JUDGE_LANE_CWD`. Pointed at a PR in another repo, the head ref cannot resolve locally, so `shapeReadFinding` (we:scripts/operations/review-pr.mjs) degrades instead of erroring: `degraded: true`, empty `netChangedFiles`, empty `diffText` — handing the judge an EMPTY diff, a false-pass hazard. Reproduced live against plateau-app#139.

## Where the local-git-only assumption lives

- `readPr({ pr, repo, exec, cwd = REPO_ROOT })` (we:scripts/operations/review-pr-io.mjs) defaults `cwd` to `REPO_ROOT` (line 40: `resolve(HERE, '..', '..')`, i.e. this web-everything checkout) and never checks it against the `repo` argument.
- `const gitExec = exec || execFileIn(cwd)` (we:scripts/operations/review-pr-io.mjs, in `readPr`) bakes that `cwd` into every `git` call `resolveNetDiffBasis`/`computeNetDiffText`/`computeNetDiffPaths` make — there is no per-call override reachable from `--repo=`.
- `createReviewPrReader()` is wired with no `cwd` option at all: `[REVIEW_PR_OP]: () => ({ declaration: reviewPrOperation({ readPr: createReviewPrReader() }) … })` (we:scripts/operations/run.mjs). Contrast the `judge` step a few lines down in the same file — `judge: createDefaultJudge({ cwd: process.env.JUDGE_LANE_CWD || null })` — which DOES accept a lane-cwd override. `read` has no equivalent.
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
