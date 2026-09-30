---
bornAs: x33k64v
kind: story
size: 2
status: open
scope: ["we:scripts/operations/open-pr.mjs", "we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/open-pr-io.mjs", "we:scripts/pr-land.mjs", "we:scripts/operations/__tests__/open-pr.test.mjs", "we:scripts/operations/__tests__/effect-executor.test.mjs", "we:scripts/__tests__/pr-land.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "9d4c0045905a4bc77486ee97da1ea9c796a51f39"
tags: []
---

# open-pr reports complete on a refused submit; push-failed when the lane lacks the branch ref

Live 2026-09-28 ~9:12 PM ET: we:scripts/operations/open-pr.mjs printed 'complete. 1 effect(s) applied' while the submit effect's result was outcome refused (reason unverified) and no PR opened; an operator reading the default render believed the PR was open. Separately, run from a lane whose HEAD was not the branch tip it halted with 'push-failed'. MVP: the default render names the submit outcome (opened #N / refused: reason) and exits non-zero on refused; the push-failed halt says the lane HEAD is not the ref's tip and how to fix it (acquire --base=<tip>). Must: tests for both renders.

## Design

Premise checked against `main` (9d4c00459): still live. `git log` shows no fix; `we:scripts/operations/cli-adapter.mjs:1306-1307` renders every `stopped === 'complete'` run as `complete. N effect(s) applied.` with exit 0, and the `open-pr.submit` sink (`we:scripts/operations/open-pr-io.mjs#createOpenPrSinks`) deliberately RETURNS a `refused` classification instead of throwing (only `unrun` throws), so a refused submit is an "applied" effect and the run completes. The real submit outcome sits only in `findings.submit.effects[0].result` (see `extractSubmitResult`, `we:scripts/operations/open-pr.mjs`), which the default (non-`--json`) render never reads. Scope is widened from `we:open-pr.mjs` alone to the files the fix genuinely touches: the render lives in `we:cli-adapter.mjs`, and the push-failed text is emitted at `we:scripts/pr-land.mjs:875`.

Mechanism:
1. `we:open-pr.mjs` exports a pure `describeSubmit(result)` → `{ line, failed }`: `opened` → `submit: opened #N <url>` (not failed); `refused` → `submit: REFUSED (<reason>) — <detail>` plus the PR number when the refusal is post-open (`check-red`, etc.), failed; `unrun` (non-dry-run) → `submit: NOT RUN — <reason>`, failed; `dry-run` → `submit: dry run — nothing opened`, not failed. It reuses `extractSubmitResult`, so the nested-path knowledge stays in one place.
2. `we:cli-adapter.mjs` `renderOutcome`'s `complete` branch consults a small per-op table `RUN_SUMMARIES = { 'open-pr': (run) => describeSubmit(extractSubmitResult(run)) }` (ops absent from the table render exactly as today). It replaces the misleading `complete. N effect(s) applied.` headline with the submit line and returns `code: 1` when `failed`. `extractSubmitResult` takes the payload envelope, so the table passes `{ findings: run.findings, stopped }` (same shape; asserted in test 4). The `--json` branch and its exit code are deliberately UNTOUCHED: existing JSON callers (`deliver-item-wrapper`, `probation-build-run`, `land-prevention-card`) parse the payload and changing exit semantics for them is unverified and not needed for the incident. The `NOT RUN` branch of `describeSubmit` is defensive only: a non-dry-run `unrun` already throws in the sink and ends as `effect-halted` (exit 1).
3. The push-failed hint must survive the `open-pr` path, which the live incident took. `push-failed` maps to `unrun`, so `we:scripts/operations/open-pr-io.mjs#createOpenPrSinks` throws, and today its message uses only `out.reason` (never `out.detail`) → the run ends `effect-halted`. Change the throw message to include `out.detail` when present.
4. `we:pr-land.mjs:875`: extract a pure exported `pushFailedDetail(message, { SRC, REF, REMOTE })`. It classifies on the FULL `e.message` (execFileSync's `Command failed: git push …\n<stderr>`; today's `split('\n')[0]` keeps only the stderr-free first line, so detection must run BEFORE truncation) for `non-fast-forward`, `[rejected]` or `fetch first` (the lane-lacks-the-ref case), and if matched appends: `the lane HEAD is not the tip of ${REF} — re-acquire the lane with \`we:lane-pool.mjs acquire --base=<tip>\` (fresh lane; verify `--base` accepts a `lane/` ref/origin tip and say so if not) or fetch and rebase onto origin/${REF}, then re-run`. An unrecognised push failure keeps today's detail unchanged.

## MVP

Musts only:
- Default render of a completed `open-pr` run names the submit outcome (`opened #N` / `REFUSED: <reason>` / `NOT RUN`) and exits non-zero on refused (unrun already halts with exit 1).
- The `push-failed` detail reaches the operator through the sink's throw message, and names "lane HEAD is not the ref's tip" and the `acquire --base=<tip>` remedy when the failure is a non-fast-forward rejection.
- Tests for both renders.

Out of scope (Follow-ups below): a general per-op summary hook on the declaration, changing the sink to throw on refused, auto-fixing the lane base.

## Test plan

1. `describeSubmit` (we:open-pr.test.mjs): refused result `{outcome:'refused', reason:'empty-body'}` → `failed:true` and line contains `REFUSED` and `empty-body`. RED before: `describeSubmit` does not exist.
2. `describeSubmit` opened → line contains `#123` and the url, `failed:false`; unrun (non-dry-run) → `failed:true`, contains `NOT RUN`; `dry-run` unrun → `failed:false`. RED: same.
3. `describeSubmit` post-open refusal `{outcome:'refused', reason:'check-red', pr:9}` names PR 9 (the PR exists). RED: same.
4. `renderOutcome` (built on the REAL `openPrOperation` declaration via `startRun`/`driveRun` with `createOpenPrSinks({ run: () => ({outcome:'refused', reason:'empty-body'}) })` — `atEffectStep` fixtures do not use `open-pr`): a completed `open-pr` run with a refused submit renders `REFUSED`, NOT the string `complete. 1 effect(s) applied`, and `code` is 1. RED before: current render is `complete. 1 effect(s) applied.` with code 0 — the exact live incident.
5. `renderOutcome` with an `opened` submit → code 0 and `opened #N`; and a non-`open-pr` completed run still renders `complete. N effect(s) applied.` code 0 (guards the table from leaking). Second half passes before and after by design (regression pin).
6. `renderOutcome({json:true})` for the refused run keeps code 0 and the same payload (pins the deliberate no-change; passes before and after).
7. `we:pr-land.test.mjs`: unit tests of pure `pushFailedDetail` (no harness exists for the top-level script): a full message containing `! [rejected] … (non-fast-forward)`, and one containing `(fetch first)`, each yield detail matching `not the tip` and `--base=`; an unrelated failure (`Permission denied`) returns today's detail unchanged. RED: `pushFailedDetail` does not exist.
8. End-to-end through the real declaration: `createOpenPrSinks` with a runner returning `{outcome:'unrun', reason:'push-failed', detail:'…not the tip…'}` → the run stops `effect-halted`, and the rendered HALTED line contains the hint. RED: the throw message omits `detail`.

## Proof plan

- Refused, live: from a scratch lane with one trivial commit, `node we:scripts/operations/run.mjs open-pr --ref=lane/proof-4386-refused --sha=HEAD --mode=no-wait --bodyFile=<path to a 0-byte file>` (passes the plan's non-empty-PATH check; pr-land refuses `empty-body` AFTER pushing). NOTE this really pushes `lane/proof-4386-refused` to origin — clean up with `git push origin --delete lane/proof-4386-refused`. Record before (`complete. 1 effect(s) applied`, exit 0, on main's code) and after (`submit: REFUSED (empty-body)`, exit 1, on the lane's code).
- push-failed, live: push commit A to `lane/proof-4386-tip` from one lane; in a second lane reset to origin/main plus a different commit B and run `open-pr --ref=lane/proof-4386-tip --sha=HEAD --mode=no-wait --bodyFile=<non-empty>`; before: HALTED with only `push-failed`; after: HALTED message carries the not-the-tip hint. Clean up with `git push origin --delete lane/proof-4386-tip`.
- Cheaper fallback if a live push is unwanted: the test-8/test-4 drivers with injected runners, showing the same before/after render strings.
- `npm run check:standards` and the three touched test files green.

## Follow-ups

- Replace the `RUN_SUMMARIES` table in `we:cli-adapter.mjs` with a declared per-operation `summarize` field (needs a `RESERVED_DECLARATION_KEYS` change in `we:registry.mjs`) so other ops with refusal-shaped effect results get the same treatment.
- Audit other operations whose sinks return `refused`/`fail` classifications for the same "complete" misreport.
- Have `open-pr`/`pr-land` detect a stale lane base up front (before the push) and fail with the same remedy.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/open-pr.test.mjs we:scripts/operations/__tests__/effect-executor.test.mjs we:scripts/__tests__/pr-land.test.mjs` — the new refused-render and push-failed-hint cases fail before this item lands and pass after.
