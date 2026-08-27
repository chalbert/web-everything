---
bornAs: x9nkmoz
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope: ["we:scripts/review-corpus/stability.mjs", "we:scripts/review-corpus/__tests__/stability.test.mjs"]
tags: []
---

# Measure run-to-run stability of a review

No layer of the design addresses determinism. Coverity caps run-to-run churn under 5% per release and bans randomisation outright, because developers model warnings on compiler warnings; measured LLM-judge test-retest consistency runs 50 to 91%. Review the same PR twice and report finding-set overlap. Cheap, and currently nobody knows the number.

## What was measured, and what it therefore is not

A live repeated run costs ~$0.43 per PR and needs a model, so it is neither runnable in CI nor repeatable by a reader. A replayed run is free but scores the deterministic gates, not the juror. `we:scripts/review-corpus/stability.mjs` reports both, kept apart:

- **Section 1, the headline — recorded live repeats.** The corpus already holds pairs of real juror rounds that ran against the **same head sha**. Those are genuine repeated live runs on identical input, already paid for. This is the only section that says anything about the juror.
- **Section 2 — replay determinism.** The gate replay run twice and compared. The "ban randomisation" precondition for the deterministic layer, not a measure of review stability.

**What section 1 does not cover.** It is not a fresh experiment; it reports what the corpus happens to have recorded. The repeat pairs are a **convenience sample** — a round repeats against an unchanged head because a human re-ran it, which correlates with rounds that were going badly, and the bias direction cannot be estimated from the corpus. The corpus records no model id, prompt revision, roster or care setting per round, so "identical input" means identical head sha, **not** identical reviewer configuration; some churn may be version drift. It covers only the PRs whose recorded rounds repeat a head, and nothing outside the corpus.

**Not a gate.** The script has no threshold and exits 0 on any number. A threshold is a later decision with this evidence behind it.

## Done when

1. **Executable** — `npx vitest run stability -t "#3310" | grep -qE "Tests +[0-9]+ passed"` exits 0 on this branch and non-zero on `origin/main`, where no `stability` suite exists.
2. **A figure, not just an implementation** — running `we:scripts/review-corpus/stability.mjs` with `--missed-on-unchanged-input --replay-cases=all` prints a churn rate, a verdict-flip rate and the pair count they rest on, measured from the real corpus.
