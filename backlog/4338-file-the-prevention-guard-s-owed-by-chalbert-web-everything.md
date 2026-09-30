---
bornAs: xzqw37h
kind: story
size: 3
status: open
scope: ["we:scripts/operations/probation-heal-run.mjs", "we:scripts/lib/model-probation.mjs", "we:scripts/lib/probation-launcher.mjs", "we:scripts/operations/__tests__/probation-heal-run.test.mjs", "we:scripts/lib/__tests__/model-probation.test.mjs", "we:scripts/lib/__tests__/probation-launcher.test.mjs", "we:scripts/lib/__tests__/model-probation-graduation.test.mjs"]
dateOpened: "2026-09-27"
preparedDate: "2026-09-30"
preparedAgainstSha: "4b83f97d310842cbedba1bc0cc2481775fe52550"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2819's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2819's review (reviewed head `2c4ff2d2cbe0b19f606421cc2f7edec1d196762b`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/operations/probation-heal-run.mjs:130` — Add a unit test in we:probation-heal-run.test.mjs asserting that dead-end outcomes (`gate-red`, `escalated-needs-human`) never call `io.appendScorecard`, mirroring the existing assertion that the mechanical/no-op path appends none — this is a deterministic, script-checkable gate on the same test file already covering the arc.
2. `we:scripts/operations/probation-heal-run.mjs:178` — Add a deterministic post-diff path gate alongside healDiffWithinEnvelope — reject/discard (same as an oversized diff) if any path in the worker's actual diff is isStatuteTierPath or in DISPATCH_MACHINERY_PATHS, or falls outside the dispatch's own declared scope — with a red test asserting a small worker diff touching we:docs/agent/platform-decisions.md is rejected pre-push.
3. `we:scripts/lib/model-probation.mjs:300` — Add a deterministic default-call regression test using otherwise qualifying evidence with a critical miss, and require either the real miss reader or a fail-closed missing-reader result.
4. `we:scripts/lib/probation-launcher.mjs:143` — Use machine-readable, NUL-delimited Git path output with explicit rename handling, and gate the launcher with a temporary-repository integration test covering a renamed file.
5. `we:scripts/operations/probation-heal-run.mjs` — A real-IO unit test for `discardChanges` that creates a new file, intent-adds it, and verifies the file is successfully removed from the working tree.

## Premise check (current `main`, 2026-09-30)

All five guards are still owed — no commit names #4338 or `xzqw37h`, and none of the guards exists. Line numbers in the list above have drifted; the real anchors are below. One finding is reshaped: guard 1 as literally worded contradicts tested, intended behaviour (see Design §1).

## Design

Everything stays inside the six `scope:` files; `isStatuteTierPath` / `DISPATCH_MACHINERY_PATHS` are only *imported* from `we:scripts/lib/provider-routing.mjs:219,233`.

1. **Dead-end launch rows (`we:scripts/operations/probation-heal-run.mjs:85-92`, `finish`).** The finding says dead ends must "never call `io.appendScorecard`". That is wrong for the current design: `finish` appends one `probation-launch` row whenever the *worker* ran (`executor === worker.executor`), and the existing test at `we:scripts/operations/__tests__/probation-heal-run.test.mjs:283-286` asserts an `escalated-needs-human` row IS appended. The real invariant the finding is protecting is *"a dead end never becomes a judged trial"*: `pendingProbationLaunches` (`we:scripts/lib/model-probation.mjs:313`) only picks up `launchOutcome === 'healed'`. So the guard is a test, not a behaviour change: drive `gate-red` (envelope overflow, gate still red, checker reject) and `escalated-needs-human` through `runProbationHeal`, assert each appended row has `outcome: null`, `verifiedBy: null` and a non-`healed` `launchOutcome`, then feed those rows to `pendingProbationLaunches` and assert `[]`. Also assert the mechanical/no-op path appends none (the existing half).
2. **Post-diff path gate (`we:scripts/operations/probation-heal-run.mjs:156`, next to `healDiffWithinEnvelope`).** Add a pure `healDiffPathsAllowed(paths, { scope })` in `we:scripts/lib/probation-launcher.mjs` returning `{ok, reason}`. It rejects any path that is `isStatuteTierPath`, is in `DISPATCH_MACHINERY_PATHS`, or — when `scope` is non-empty — is outside the dispatch's declared scope (scope entries use the same rules as `declaredScopePaths`/`pathInScope` in `we:scripts/operations/probation-build-run.mjs:119-144`: strip `we:`, ignore foreign-repo entries, trailing `/` is a directory prefix; copied, not imported, since build-run's are private and it is out of this item's scope). An empty scope applies only the statute/machinery checks (a ci-heal may be dispatched with no scope). Call it right after the envelope check; on reject, `io.discardChanges` and `finish('gate-red', …, 'not pushed: <reason>')` — identical to the oversize path.
3. **Default-call critical-miss guard (`we:scripts/lib/model-probation.mjs:411`).** `graduationProgress`'s default `criticalMissesFor = () => []` silently reports zero misses when the caller forgets to pass the real reader — a veto-free graduation report. Make the parameter fail closed: when omitted, every triple reports `criticalMisses.met = false` with `have: null`, and both the `next` text and `renderGraduationProgress` get a `criticalMisses.have == null` branch reading "critical-miss reader not supplied" (never "null critical miss(es)"). Existing callers in `we:scripts/lib/__tests__/model-probation-graduation.test.mjs` (lines 29/36/67) either pass an explicit `() => []` or have their assertions updated — that file is added to `scope:`. The sibling silent default `judgedTrialRow`'s `isCriticalMiss = () => false` (`:346`) is deliberately left for Follow-ups. The CLI already passes the real `criticalMissesFor` (`:524`), so behaviour there is unchanged. Test: qualifying evidence (≥ minTrials verified, informative rows) plus a row `isCriticalMiss` would flag, called with no reader → not met/not graduatable; with the real `we:scripts/lib/critical-work.mjs` reader → the miss is counted.
4. **NUL-delimited path output (`we:scripts/operations/probation-heal-run.mjs:269-279`, `summarizeNumstat` at `we:scripts/lib/probation-launcher.mjs:264`).** `git diff --numstat` and `ls-files` are newline-split and C-quoted for non-ASCII/special paths, so a quoted octal-escaped name reaches `git add` as a literal-quote string and fails. Switch `untracked`, `diffNumstat` and `discardChanges`' listing to `-z`; `summarizeNumstat` accepts BOTH shapes — it splits on `\0` when the input contains one, else on `\n` — because `we:scripts/operations/probation-build-run.mjs` (lines 370/444/490) also calls it with its own newline-shaped `diffNumstat` (`:735-742`); that build arc is unchanged and stays compatible (its quoted-path weakness goes to Follow-ups). NUL records are `added\tdeleted\tpath\0`; keep `--no-renames` (a rename becomes explicit delete+add, both paths listed — the "explicit rename handling"). `newUntrackedPaths` is unchanged. Test: a temp git repo (real `git`, `mkdtempSync`) where a file is renamed and a non-ASCII-named file is added → `realIo().diffNumstat(...)` + `summarizeNumstat` yield both the old and the new path, unquoted, and `git add -- <paths>` succeeds.
5. **Real-IO `discardChanges` test (`we:scripts/operations/probation-heal-run.mjs:282`).** In a temp repo: create a pre-existing untracked file, then a worker-created new file that is `--intent-to-add`ed (as `diffNumstat` does) plus a tracked edit; call `realIo().discardChanges(dir, baseSha, preexisting)`; assert the new file is gone, the tracked edit is reverted, and the pre-existing untracked file survives.

## MVP

Musts: the five guards above, as tests plus the two small code changes they force (guard 2's gate, guard 3's fail-closed default, guard 4's `-z` parsing). Guard 1 and 5 are tests only.

Out of scope (→ Follow-ups): deduplicating the scope helpers between `we:scripts/operations/probation-build-run.mjs` and the launcher, applying guard 2 to the build arc, changing whether dead ends write launch rows at all.

## Test plan

- `we:scripts/operations/__tests__/probation-heal-run.test.mjs` — *dead-end rows are never judgeable*: `gate-red` (oversize / gate still red / checker REJECT) and `escalated-needs-human` (hook tamper) each append a launch row; `pendingProbationLaunches` over them is `[]`. Regression guard: GREEN on today's code; its red proof is a mutation (make `finish` write `launchOutcome: 'healed'` on a dead end → fails).
- `we:scripts/operations/__tests__/probation-heal-run.test.mjs` — *statute path in a small diff is rejected pre-push*: a numstat line adding `we:docs/agent/platform-decisions.md` → outcome `gate-red`, `discard` called, no `commit`/`push`. Also a `DISPATCH_MACHINERY_PATHS` file, and an out-of-scope path with a non-empty `--scope`. Red today: the diff fits the envelope and is pushed. Plus a green case: a non-empty scope with in-scope files still heals. Note the scope rule can raise the `gate-red` rate for heals that legitimately fix out-of-scope files; accepted, since an empty scope skips only that rule.
- `we:scripts/lib/__tests__/probation-launcher.test.mjs` — `healDiffPathsAllowed` unit cases (statute, machinery, out-of-scope, dir-prefix scope, empty scope, foreign-repo scope entry ignored). Red today: function absent.
- `we:scripts/lib/__tests__/probation-launcher.test.mjs` — `summarizeNumstat` on NUL-delimited input incl. a path with spaces and a `-\t-` binary. Red today: newline parser.
- `we:scripts/lib/__tests__/probation-launcher.test.mjs` (or heal-run test) — temp-repo integration: rename + non-ASCII file. Red today: quoted path returned.
- `we:scripts/lib/__tests__/model-probation-graduation.test.mjs` — existing no-reader callers updated; render/`next` show "reader not supplied". `we:scripts/lib/__tests__/model-probation.test.mjs` — default-call regression above. Red today: default `() => []` reports `met: true`.
- `we:scripts/operations/__tests__/probation-heal-run.test.mjs` — real-IO `discardChanges` temp-repo test. Guards a regression, so it passes on today's code; its red proof is a mutation check (drop the `clean -f` line locally → it fails).

## Proof plan

- `npx vitest run` on the three test files: show the new cases failing on `main` (stash the code change) and passing after.
- Live probe of guard 2 through the real pure function: `node -e` calling `healDiffPathsAllowed` on the statute-layer decisions doc with an empty scope → `{ok:false}`.
- Live before/after for guard 4: a `node -e` script builds a temp repo (rename + non-ASCII file), prints `realIo().diffNumstat` paths on `main` (quoted) vs after (clean); guard 5 by the temp-repo test, plus the `report` subcommand of `we:scripts/lib/model-probation.mjs` still rendering (guard 3 does not change CLI output when the real reader is wired).
- `npm run check:standards` green.

## Follow-ups

- Share `declaredScopePaths`/`pathInScope` between `we:scripts/operations/probation-build-run.mjs` and the launcher, and apply the statute/machinery post-diff gate to the build arc too.
- Apply the same quoted-path fix to `we:scripts/operations/probation-build-run.mjs`'s own `diffNumstat`; fix `judgedTrialRow`'s silent `isCriticalMiss` default.
- Decide whether a dead end should write a launch row at all (currently yes, by design — it moves the worker rotation and the "launched" count).

## Done when

1. **Executable** — `npx vitest run probation-heal-run model-probation probation-launcher` (name filters covering the three test files plus the graduation test) passes; the guard-2/3/4 cases fail on the pre-change code, and guard-1/5 regression tests fail under the stated mutation.
