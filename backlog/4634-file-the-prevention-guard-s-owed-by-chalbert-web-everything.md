---
bornAs: xz6ppko
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/conveyor/prepare-failure-policy.mjs", "we:docs/agent/testing.md", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/conveyor/__tests__/prepare-failure-policy.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "db98be3296929218431ced01a9ca0982b5f8f5c5"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3090's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:252` — Add a daemon test per release path: settled-row only, ledger-only, and ledger plus settled row. Lint that each branch in the `released` computation is hit by a test.
2. `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:1598` — When the fixture that a guard test relies on is removed, require a replacement test for the new behaviour, such as a stale wrapper-failed row producing a hold and a card. Flag deleted fixture rows in review.
3. `we:scripts/operations/probation-build-run.mjs:223` — Known-cause labels should require a matching diagnostic, for example the stamp-diagnostic code for result-lost. Otherwise treat the failure as unknown. Add a classifier table test where structurally identical failures with different diagnostics map to different causes.
4. `we:skills-src/conveyor/build-dispatch-daemon.mjs:73` — Exclude attempts whose recorded cause is `infra-transient` from the route latch. Add a test that two transient failures leave the route on probation.
5. `we:scripts/conveyor/prepare-failure-policy.mjs:76` — Fingerprint only stage plus a closed-enum cause (or a fixed normaliser that drops free text). Add a test that two different terminal texts for the same stage produce one filed card.
6. `we:scripts/conveyor/prepare-failure-policy.mjs:52` — On a corrupt ledger, hold all candidates (fail closed) or refuse to tick until an operator clears it. Add a test asserting a corrupt ledger does not release or re-open a previously held item.
7. `we:skills-src/conveyor/build-dispatch-daemon.mjs:1067` — Record a ledger attempt (cause unknown, held) when a `starting` marker has no terminal record at reclaim time. Correct the doc line and add a test for a crashed worker.
8. `we:docs/agent/testing.md:671` — A review lens that requires every absolute mechanical claim ("do not expire", "never") in documentation to be matched by a corresponding test assertion (e.g., `expect(lease).toBe(Infinity)`).
9. `we:skills-src/conveyor/build-dispatch-daemon.mjs:427` — A strict 100% line coverage requirement on `runBuildDispatchTick` enforced by Vitest in CI, ensuring every new data branch has a corresponding test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3090@d7a44d0a3d773d3b897a8edc58712863b8e4f7c5

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/prepare-failure-policy.test.mjs we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs we:scripts/operations/__tests__/probation-build-run.test.mjs` fails before this item lands (guards #3–#7 below are RED; #1/#2/#8 are hardening, proven by mutation) and passes after, with `npm run check:standards` green.

## Progress

- 2026-10-02 prepare: premise check against `origin/main` @ db98be329. `git log --grep` finds only the filing commits (068891a76, merge fa861254b, JIT-number 3875062ef) — no guard has landed, so the goal is not delivered.
- Drift corrected (citations only; goal and scope unchanged). Old → current location:
  - #1 `we:build-dispatch-daemon.mjs:252` → the `released` computation, `we:build-dispatch-daemon.mjs:~264-278` (two loops: settled-row loop, ledger-only loop).
  - #2 `we:build-dispatch-daemon.test.mjs:1598` → the stale `wrapper-failed` fixtures now live at `:1113-1120` / `:1745`; the guard is a replacement test plus a review rule (nearby `:1590-1605` is an unrelated retirement-error test).
  - #3 `we:probation-build-run.mjs:223` (unrelated worker-model code) → classifier is `classifyPrepareFailure`, `we:prepare-failure-policy.mjs:9-17`; its evidence producer is `we:probation-build-run.mjs:268`.
  - #4 `we:build-dispatch-daemon.mjs:73` → `prepareRouteFallback`, `:75-80` (counts every non-PR attempt, no cause filter).
  - #5 `we:prepare-failure-policy.mjs:76` → `recordPrepareFailure` fingerprint, `:~76-80` (signature embeds free text).
  - #6 `we:prepare-failure-policy.mjs:52` → `readFailureState`, `:~52-60` (corrupt ledger renamed, returns empty).
  - #7 `we:build-dispatch-daemon.mjs:1067` → `cliStampPrepare` / `cliReadStampFailure`, `:~1050-1085` (`starting` marker returns `null`).
  - #8 `we:docs/agent/testing.md:671` → "Stamp-recovery reservations do not expire" paragraph, `:~669-672`.
  - #9 `we:build-dispatch-daemon.mjs:427` → `runBuildDispatchTick`, declared at `:221` (the `:427` region is its dispatch loop).

## Design

Nine independent guards, each a test (or one doc rule) added next to the code it protects. No behaviour change except where a guard's own fix is stated.

1. **Release-path coverage.** In `we:build-dispatch-daemon.test.mjs` add three ticks around the `released` set: settled-row only, ledger-only, settled row + ledger. Assert each releases (or not) exactly as the two loops dictate. Add a small test that parses the `released` block and fails if a `released.add` branch has no named test.
2. **Fixture-removal guard.** Add the replacement test the review asked for: a stale `wrapper-failed` settled row yields a hold and one filed card. Add a one-line review rule to `we:testing.md` (deleted fixture rows need a replacement test).
3. **Known cause needs a diagnostic.** In `classifyPrepareFailure` require the matching diagnostic field per cause via a new string field `evidence.diagnostic` (a closed code such as `stamp-result-lost`), set by the producer at `we:probation-build-run.mjs:268` from the stamp-failure path at `:305`/`:550`; `result-lost` needs `diagnostic === 'stamp-result-lost'` in addition to the two booleans, else `unknown`. Add a table test in `we:prepare-failure-policy.test.mjs`: same booleans, different diagnostics → different causes. The existing assertion at `we:prepare-failure-policy.test.mjs:37` (booleans alone → `result-lost`) must be rewritten to include the diagnostic.
4. **Route latch ignores transient.** In `prepareRouteFallback` skip attempts whose cause is `infra-transient`. The cause source is the scorecard row's own `r.evidence`, already classified the same way at `we:build-dispatch-daemon.mjs:452`; rows without evidence still count as failures. Test (new rows carry `evidence.error` e.g. `HTTP 429`; existing plain-row test at `:2036-2043` stays unchanged): two transient failures keep the route on probation.
5. **Stable fingerprint.** Build the `recordPrepareFailure` signature from `stage` plus the closed-enum cause only (drop free terminal text and the `\d` regex). Test: two different terminal texts at one stage file one card.
6. **Corrupt ledger fails closed.** On a corrupt ledger `readFailureState` must not read as "no failures". Return a sentinel (`corrupt: true`) and have the daemon hold every candidate this tick. Test: a corrupt ledger does not release or re-open a previously held item. The existing test at `we:prepare-failure-policy.test.mjs:64` ("degrades to empty state") must be updated to the new contract (bytes still preserved, but state flagged corrupt).
7. **Crashed stamp worker.** In `cliStampPrepare`, when a `starting` marker has no terminal record at reclaim time, record a ledger attempt (cause `unknown`, held). Fix the doc line in `we:testing.md` to match. Test: crashed worker → held attempt.
8. **Absolute-claim lens.** Add a review-lens bullet to `we:testing.md`: every absolute mechanical claim ("do not expire", "never") needs a test assertion. The lease assertion already exists (`we:build-dispatch-daemon.test.mjs:1329-1330`, `Number.isFinite(STAMP_RECOVERY_LEASE_MINUTES)`); the defect is the doc wording "do not expire" (`we:testing.md:~669`), so the fix is to reword it to "finite lease" and add the lens bullet. This is a doc edit, not RED-first.
9. **Tick coverage floor — explicitly descoped.** v8 thresholds are per file (`we:vitest.config.ts` thresholds), not per function, so "100% on `runBuildDispatchTick`" (declared `:221`) is not deliverable as filed. This card does NOT deliver #9; guard #1's branch-hit test is only a partial substitute. The builder must file the Follow-up below and must not claim #9 delivered when resolving.

## MVP

Musts: guards 1–8 as designed above (RED-first for #3–#7; hardening for #1/#2/#8). Guard #9 is an explicit, openly descoped item (see Design #9 and Follow-ups): not delivered here. Done when the Executable command passes and `npm run check:standards` is green.

Out of scope: a per-function 100% coverage gate on `runBuildDispatchTick` (see Follow-ups); any refactor of the release or fingerprint logic beyond what each guard states.

## Test plan

Hardening (characterization, GREEN today — not RED; each is proven by mutation, see Proof plan):
- `released` settled-row only, ledger-only, ledger+settled — asserts each release path; settled-only partly overlaps existing `:1617-1624` / `:1720-1727`, so add only the missing combinations.
- Branch-hit lint — fails if a `released.add` branch has no named test (RED only against a deliberately added unnamed branch).
- Stale `wrapper-failed` row → hold + one card — near `:1730-1737`; add only if no existing case asserts both hold and card.
- #8 doc reword + lens bullet — no test; verified by reading the doc.

RED today:
- Classifier table: identical booleans, different diagnostics → `result-lost` vs `unknown` — RED: today the booleans alone give `result-lost`.
- Two transient failures keep route on probation — RED: `prepareRouteFallback` counts them and latches to Claude.
- Two terminal texts, one stage → one card — RED: text differences produce two fingerprints.
- Corrupt ledger holds all candidates, no re-open — RED: today it returns empty state and releases.
- Crashed stamp worker (`starting`, no terminal) → held `unknown` attempt — RED: today returns `null`, no record.

## Proof plan

- Run the Executable command before (new cases RED, quote the failures) and after (green) in the lane.
- Mutation check for #1/#2: delete one `released.add` branch locally, show the new tests fail, restore.
- #3/#4/#7 before/after: run the new cases against unmodified code (quote RED output), then after the fix. For #7 additionally replay a log containing only a `starting` marker through `cliStampPrepare` and show a held `unknown` attempt in a temp ledger.
- Live probe for #5/#6: run `readFailureState` and `recordPrepareFailure` against a temp ledger dir (corrupt file; two differing terminal texts) and show one card / a hold, before and after.

## Follow-ups

- Strict 100% line coverage for `runBuildDispatchTick` (guard #9): v8 thresholds apply per file, not per function, so this needs a design (extract the tick into its own file, or a custom branch-hit check). File as its own backlog item when building this one.
- Generalise guard #3 into a classifier-evidence lint for any future cause label.
