---
bornAs: x5ig5om
kind: task
status: resolved
parent: "3029"
relatedTo: ["3037"]
scope: ["we:scripts/operations/review-pr.mjs", "we:scripts/lib/judge-spawn.mjs"]
dateOpened: "2026-08-17"
dateStarted: "2026-08-17"
dateResolved: "2026-08-17"
tags: [operations, epic-3029, review-pr, bug]
---

# review-pr operation: judge-spawn refuses a tool-bearing juror with no cwd flag to supply one

At least 3 independent reviewers on 2026-08-17 hit the same error trying to use the `review-pr` operation
directly (not via the `JUDGE_LANE_CWD` env-var workaround dispatch prompts have been threading through
manually all day): `judge-spawn: refusing to spawn a TOOL-BEARING juror — no cwd was supplied`, and the
operation exposes no `--cwd` flag to supply one. One reviewer additionally found `--model` isn't a valid
CLI flag on `review-pr` at all (it only accepts `--pr/--repo/--lens/--aim/--actor`), so a dispatch prompt
written with `--model=sonnet` fails outright. Every reviewer who hit this fell back to a fully manual review
instead — the operation works, but only when invoked via an undocumented environment-variable side channel
external callers wouldn't know to use.

## Why this matters

This isn't cosmetic — it's the direct, load-bearing evidence for why "declare once, generate every caller"
(epic #3029) matters. A CLI adapter that silently requires an env var no `--help` output mentions is exactly
the kind of hand-wiring gap the whole epic exists to eliminate; every reviewer today had to independently
rediscover the same workaround by reading dispatch prompts rather than the tool's own interface.

## Done when

1. **Executable** — `node we:scripts/operations/run.mjs review-pr --pr=<N> --repo=<R> --lens=<tool-requiring-lens>`
   succeeds without `JUDGE_LANE_CWD` set, using a `--cwd` flag (or equivalent) the CLI adapter documents in its
   own `--help` output; a test invoking a tool-bearing lens without a manually-threaded env var passes.
2. `--model` either becomes a real accepted flag or is removed from every dispatch-prompt example that
   currently references it, so the two stop diverging.

## Progress

**Both done-when clauses met; the fix is in the ADAPTER, so every declaration with a juror gets it.**

- **`--cwd` and `--model` are CONTROL flags of the derived command line** (`we:scripts/operations/cli-adapter.mjs`),
  not input fields of `review-pr`. That placement is the point: `CONTROL_FLAGS` grows by two and *any* operation
  with a `judge` step gains the flags, so the next declaration does not re-find this gap. Keeping `--model` OUT
  of `declaration.input` is also what preserves #3028's property — nothing in a run's INPUT can reach the
  juror's argv; an operator override travels a different path and passes `assertSafeJudgeRequest` before it can
  become a flag position.
- **Derived from the step kinds, exactly like the resume line.** `declaresJudgeStep` decides both what `--help`
  prints and what the parse accepts, so a `compute`-only operation (`suggest-next`) REFUSES `--cwd` with a
  reason instead of accepting a flag that would do nothing.
- **The help text names the refusal verbatim** — `refusing to spawn a TOOL-BEARING juror` — so the round trip an
  operator actually makes (read the error, run `--help`, match the words) terminates. The unknown-flag message
  now lists the control flags too; listing only the five declared inputs is what made `--cwd` look impossible.
- **`JUDGE_LANE_CWD` is kept as the fallback, and the flag wins over it.** Dispatch prompts and wrappers already
  thread the env var; breaking them to make a point would trade one paper cut for another.
- **The judge is built AFTER the parse.** `runOperationCli` takes a `makeJudge` factory that receives the parsed
  flags; `we:scripts/operations/run.mjs` supplies it. A judge pre-built by the caller (as it was) could not have
  honoured a flag parsed later — which is why the flag could not have existed before this.
- **`we:skills-src/review/SKILL.md` now shows `--cwd` in its one documented invocation.** The skill's command as
  written would have failed for every reader, since `review-pr`'s juror is tool-bearing.
- **What the adversarial review changed.** Three fixes worth naming: the test now drives the command line's OWN
  exported judge factory (`createCliJudgeFactory`) instead of a local copy of it — with the copy, deleting the
  flags from `we:scripts/operations/run.mjs` entirely left 14 of 15 tests green, so the precedence was asserted
  and never exercised;
  the run record now states WHICH model judged (`we:scripts/operations/engine.mjs` read `model`/`effort`/`lens`
  off the declared request unconditionally, which became a false record the moment an operator could override
  it — a REPORTED model now wins, with the declared one as the fallback, while `lens` and `effort` stay
  declaration-authoritative because nothing can make them diverge); and `--model=--bare` is no longer
  described in `we:scripts/operations/review-pr.mjs` as having "no path to the juror's argv at all", because it
  now has a path and is refused ON it, twice.
- **`--cwd` is the juror's WORKING directory, not the checkout the subject is read from** — the help says so in
  the negative, because the open #3137 wants a second cwd for the `read` step and the two must not be
  conflated. That flag should be named for what it points at, never as a widening of this one.
- **Tests:** `we:scripts/operations/__tests__/juror-flags.test.mjs` (19) plus two in
  `we:scripts/operations/__tests__/engine.test.mjs` pinning the telemetry asymmetry with a reported-≠-declared
  fixture — the acceptance one drives a
  tool-bearing juror through `runOperationCli` with `JUDGE_LANE_CWD` DELETED from the environment and the REAL
  `assertLaneCwd` running inside the injected spawn, so the guard under test is the shipped one and no
  subprocess is paid for. Same run without the flag still refuses, which is what proves the flag supplied the
  lane. One child process runs `we:scripts/operations/run.mjs review-pr --help` so "documented in its own
  `--help` output" is asserted through the real entry point.
