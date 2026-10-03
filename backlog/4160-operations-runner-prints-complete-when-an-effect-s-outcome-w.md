---
bornAs: x2zl9ow
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/__tests__/render-outcome-effect-refusal.test.mjs"]
scopeRationale: "we:scripts/operations/run.mjs is named only as an explicit no-change file (the message and exit code come from cli-adapter renderOutcome); the effect-executor and open-pr test files are run unchanged as regression checks, not edited."
dateOpened: "2026-09-25"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# Operations runner prints complete when an effect's outcome was refused

Live 2026-09-25: node we:scripts/operations/run.mjs open-pr printed 'complete. 1 effect(s) applied.' while the open-pr.submit effect's recorded result was outcome refused, reason verify-unfinished, pr null — the refusal was only visible by reading the run record under .operations/runs/. The default render must surface an effect-level refused/failed outcome (reason plus detail) and exit non-zero, so a caller never mistakes a refusal for success. Prove on the live open-pr verify-unfinished case, before and after.

## Progress

- **Old scope:** `we:scripts/operations/run.mjs`. **Corrected scope:** `we:scripts/operations/cli-adapter.mjs` plus one new test file.
  Evidence: `we:scripts/operations/run.mjs:627-631` only prints the lines it is handed and exits with the code it is handed. The line `complete. N effect(s) applied.` and its exit 0 come from `we:scripts/operations/cli-adapter.mjs:1331-1333 (renderOutcome)`. `we:scripts/operations/run.mjs` needs no edit.
- **Premise confirmed.** The `open-pr.submit` sink returns a refusal instead of throwing it, on purpose (`we:scripts/operations/open-pr-io.mjs:61-88 (createOpenPrSinks)`). So the effect is recorded `status: 'applied'` with `result.outcome: 'refused'`. The engine then stops at `complete`, and `renderOutcome` never reads `result`. The live record still exists in lane-15's runs dir, run id `open-pr-bc9f6fe8-d36f-4a91-ab4e-b3293f63b850` (effect `applied`, result `{outcome: 'refused', reason: 'verify-unfinished', pr: null}`).
- **Not already delivered.** No `result?.outcome` read exists in `we:scripts/operations/cli-adapter.mjs` on main (`e1f0523e0`).
- **Which effects carry this shape.** A census of every run record in the main checkout's runs dir finds `result.outcome` only on `open-pr.submit` (`opened` 67, `refused` 20, `unrun` 6) and `gap-sweep-status.run` (`ok` 1). The other `outcome: 'refused'` returners in code (`we:scripts/lib/dispatch-contracts.mjs:1321`, `we:scripts/operations/ci-heal-pr-dispatch.mjs:91`, `we:scripts/lib/daemon-jobs-runtime.mjs:361`) are not operation sink results. So today the change only alters `open-pr` runs.

## Design

One pure change in `we:scripts/operations/cli-adapter.mjs (renderOutcome)`, human render only.

1. Add an exported pure helper `refusedEffects(run)` next to `renderOutcome`. It returns `run.effects` entries where `status === 'applied'` and `result?.outcome` is `'refused'` or `'failed'`. It reads the RECORD, not the drive-local `applied` list. Reason: a `--resume` of a finished run applies nothing, yet the refusal is still the truth about that run (the PARKED branch already follows this rule, `we:scripts/operations/cli-adapter.mjs:1349-1352`).
2. In the `stopped === 'complete'` branch, when `refusedEffects(run)` is non-empty, return `code: 1` and these lines:
   - `run <id> — complete, but <n> effect(s) were REFUSED/FAILED — nothing they asked for happened.`
   - per effect: `  <type> (step <step>): <outcome> — <reason>`
   - per effect, when present: `    detail: <detail>` and `    pr: <pr> <url>` (a post-open refusal names a real PR, `we:scripts/operations/open-pr.mjs:315-318 (classifySubmit)`).
   - then `...spend`, then `...ownerLines`.
   When the list is empty, the branch is byte-identical to today.
3. Exit code 1 matches the other non-success stops (`effect-halted`, `step-refused`, `we:scripts/operations/cli-adapter.mjs:1360-1393`).
4. **`--json` is unchanged**: same payload, same exit 0 (`we:scripts/operations/cli-adapter.mjs:1298-1304`). The card asks for the *default render*. JSON callers already read the refusal from `findings.submit.effects[0].result` (`we:scripts/operations/open-pr.mjs:349 (extractSubmitResult)`). This is not a design fork: changing the JSON exit would turn the parse path of every in-repo caller into a throw path (table below), which the card does not ask for.
5. `outcomePayload`, the engine's `stopped` value, `we:scripts/operations/run.mjs`, and the HTTP adapter are untouched.

### Callers of the runner and how the exit change affects each

The exit code changes only when all hold: no `--json`, `stopped === 'complete'`, and at least one applied effect with `result.outcome` `refused`/`failed`. Today only `open-pr` can produce that.

| Caller | How it runs `open-pr` | Effect |
|---|---|---|
| `we:scripts/operations/probation-build-run.mjs:656-662 (openPrArgv)`, `:875-886` | `--json`, checks `r.ok` | none (JSON exit unchanged) |
| `we:scripts/operations/land-prevention-card.mjs:396-407` | `--json`, catches and re-parses `e.stdout` | none |
| `we:scripts/operations/sweep-orphan-backlog-cards.mjs:530-541` | `--json`, same catch pattern | none |
| `we:scripts/operations/deliver-item-wrapper.mjs:2436-2447 (openPr)` | `--json`, `execFileSync` throws on non-zero | none |
| `we:scripts/operations/health-file-request-land.mjs:200-204` | `--json` via `runFn` | none |
| `we:scripts/operations/build-dispatch-hold-route-land.mjs:332-336` | `--json` via `runFn` | none |
| `we:scripts/operations/prepare-stamp-land.mjs:55-58` | `--json` via `run` | none |
| `we:scripts/conveyor/orphan-claim-release.mjs:379` | `--json` via `run` | none |
| Agent briefs `we:skills-src/conveyor/delivery-agent-brief.md:403`, `we:skills-src/conveyor/prepare-item-agent-brief.md:183`, `we:skills-src/conveyor/prepare-decision-agent-brief.md:182`, `we:skills-src/conveyor/prepare-scope-agent-brief.md:165`, `we:skills-src/conveyor/investigation-agent-brief.md:184`, `we:skills-src/pr/SKILL.md:50` | all pass `--json` | none |
| A person or agent running `open-pr` without `--json` (the live case) | reads text and exit | **changed, as intended**: sees REFUSED + reason + detail, exit 1 instead of 0 |
| Every other operation through the runner (both modes) | — | none: no other sink returns `outcome: 'refused'/'failed'` (census above) |

## MVP

- `refusedEffects(run)` exported from `we:scripts/operations/cli-adapter.mjs`.
- The `complete` branch of `renderOutcome` uses it as in Design step 2.
- New test file `we:scripts/operations/__tests__/render-outcome-effect-refusal.test.mjs`.

## Test plan

New vitest file `we:scripts/operations/__tests__/render-outcome-effect-refusal.test.mjs`. Use the same import style as `we:scripts/operations/__tests__/effect-executor.test.mjs:18-29`. Cases:

1. `a complete run whose effect result is refused exits 1 and names reason and detail` — synthetic outcome: `stopped: 'complete'`, one effect `{type: 'open-pr.submit', step: 'submit', status: 'applied', result: {outcome: 'refused', reason: 'verify-unfinished', detail: 'verification … UNFINISHED', pr: null}}`. Expect `code === 1`; text matches `/REFUSED/`, `/verify-unfinished/`, `/UNFINISHED/`; text does NOT match `/complete\. 1 effect\(s\) applied\./`.
2. `a failed effect outcome is surfaced the same way` — `result.outcome: 'failed'` gives `code === 1` and names the reason.
3. `a post-open refusal prints the PR it names` — `pr: 42, url: 'https://…/42'` puts `42` in the text.
4. `an opened outcome still prints complete and exits 0` — `result.outcome: 'opened'` gives `code === 0` and first line `run <id> — complete. 1 effect(s) applied.`
5. `a requested dry-run (unrun, reason dry-run) still exits 0` — unchanged line, `code === 0`.
6. `a resumed finished run re-renders the recorded refusal` — `applied: []`, record holds the refused effect, `code === 1`.
7. `--json render is unchanged for a refused effect` — `renderOutcome({outcome, json: true})` gives `code === 0`, and the payload equals `outcomePayload(outcome)`.
8. `end to end: runOperationCli over open-pr with a refusing runner exits 1` — register `openPrOperation({parkLabels: PARK_LABELS})`; sinks `createOpenPrSinks({run: () => ({outcome: 'refused', reason: 'verify-unfinished', detail: 'x', pr: null})})`; `createMemoryRunStore()`; argv `--ref=lane/1-x`, `--sha=HEAD`, `--base=main`, and a `--bodyFile=` pointing at any non-empty string (the plan step only checks it is non-empty). Expect `stopped === 'complete'`, `code === 1`, lines name `verify-unfinished`.

Cases 1, 2, 3, 6 and 8 fail before the change (exit 0, no reason). Cases 4, 5 and 7 pass before and after (regression guards).

## Proof plan

Replay the real live record in a scratch runs dir, so no live state is touched.

1. Copy lane-15's run record for id `open-pr-bc9f6fe8-d36f-4a91-ab4e-b3293f63b850` into a scratch dir `$S/runs`.
2. From the lane root, run `we:scripts/operations/run.mjs` as: `OPERATION_RUNS_DIR=$S/runs OPERATION_CALLS_DIR=$S/calls node <runner> open-pr --resume=open-pr-bc9f6fe8-d36f-4a91-ab4e-b3293f63b850; echo "exit=$?"`.

- **Before (captured 2026-10-03 on `e1f0523e0`):** `run open-pr-bc9f6fe8-… — complete. 0 effect(s) applied.` and `exit=0`. The `verify-unfinished` refusal is not shown.
- **After:** the output says REFUSED, names `open-pr.submit`, `verify-unfinished` and the UNFINISHED detail, and `exit=1`.
- Also run the same command with `--json` before and after. Both must print the same payload and `exit=0`.

## Done when

1. **Executable** — `npx vitest run` on `we:scripts/operations/__tests__/render-outcome-effect-refusal.test.mjs` passes. Cases 1, 2, 3, 6 and 8 fail on main before the change.
2. `npx vitest run` on `we:scripts/operations/__tests__/effect-executor.test.mjs` and `we:scripts/operations/__tests__/open-pr.test.mjs` still passes.
3. The Proof plan replay shows exit 0 with no reason before, and exit 1 with `verify-unfinished` plus detail after. The `--json` replay is identical before and after.
4. `refusedEffects` and the new `complete` branch live only in `we:scripts/operations/cli-adapter.mjs`. `we:scripts/operations/run.mjs` and `outcomePayload` are unchanged.

## Follow-ups

- Whether `--json` should also exit non-zero on a refused effect. Not done here: every in-repo caller (table above) would move from parsing stdout to a throw path. Some would lose the reason that way (`we:scripts/operations/health-file-request-land.mjs` and `we:scripts/operations/build-dispatch-hold-route-land.mjs` keep only the first stderr line). File it as its own card if wanted.
