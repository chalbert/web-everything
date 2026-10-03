---
bornAs: x1jgrge
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs", "we:scripts/conveyor/__tests__/lane-pool-health-watch-prevention.test.mjs", "we:package.json", "we:package-lock.json"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "70a302401313c4ac57bd86b12e9cd44aea1a32ab"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3146's independent review

Filed mechanically on approval of chalbert/web-everything#3146 at commit `1913d2883871f7a934db6e3ae0c06215010c3fef`. The independent review owed two executable prevention guards: undefined-name detection in CI or a pre-commit hook, and branch-sensitive coverage or mutation testing that detects removal of the new logic. The approved runtime fix is already present; this item delivers the remaining guards.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3146@1913d2883871f7a934db6e3ae0c06215010c3fef

## Progress

- **Old premise/scope:** the mechanical filing cited `we:scripts/conveyor/lane-pool-health-watch.mjs:515` and `we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs:101`, scoped only those two files, and left the executable acceptance command unspecified.
- **Corrected premise:** the reviewed commit added the `trackedModified` and `untracked` arguments to `isLaneAlreadyClean` inside `reclaimFinishedLanes`. The source citation still points to those arguments at `we:scripts/conveyor/lane-pool-health-watch.mjs:515`; the cancellation regression has moved to `we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs:110`. The predicate in `we:scripts/lib/lane-whois-core.mjs:212` rejects nonzero components when supplied, but retains aggregate-only compatibility when both are omitted. Removing both forwarded components therefore restores the erroneous already-clean outcome for -2 + 2. These are the guard's actual targets, not the unrelated salvage formatter added later in commit `e505317bcdfb7a6a4f06eff146cbc7fd6e54c3cd`.
- **Observed evidence:** `npx vitest run` targeting `we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs` with `-t 'components that cancel'` passed one test, with 77 skipped, during preparation. This proves the existing regression case, not completion of either prevention guard. Inspection found no active ESLint/no-undef configuration in the package scripts or CI workflow. `we:vitest.config.ts:49` excludes this watcher from coverage (it is also absent from `we:scripts/lib/trust-chain-tier.mjs`); the aggregate 80% bar is not a changed-branch gate here.
- **Corrected scope:** retain the watcher as the guarded source and its existing regression test; add the planned `we:scripts/conveyor/__tests__/lane-pool-health-watch-prevention.test.mjs` for lint enforcement and mutation checks. Add ESLint and Node globals as explicit development dependencies through `we:package.json` and `we:package-lock.json`; the new prevention test directly imports those dependencies and exercises the configured linter. Every source/config entry is thus paired with the existing watcher test or the new prevention test. No runtime-policy change is needed.

## Design

Implement a narrowly scoped prevention suite in `we:scripts/conveyor/__tests__/lane-pool-health-watch-prevention.test.mjs`, automatically collected by the existing script-test include in `we:vitest.config.ts:106`. The shard command in `we:.github/workflows/ci.yml` already runs this suite and the aggregating test job fails on a failed shard; no new workflow or repository-wide lint rollout is required.

1. **Undefined names:** use ESLint's programmatic linter with module parsing, supported ECMAScript syntax, declared Node globals, and `no-undef: error`. Lint the complete current `we:scripts/conveyor/lane-pool-health-watch.mjs`, without executing its CLI. Disable inline rule suppression for this guard. Fail on parser/configuration errors as well as undefined names. Add a negative control changing the forwarded `trackedModified` value to a deliberately undeclared identifier; require a diagnostic with rule ID `no-undef` at that use. Imported identifiers and declared locals must remain accepted. Keep the configuration in the prevention test, with direct devDependencies in `we:package.json` and corresponding lock entries in `we:package-lock.json`.
2. **Removal sensitivity:** exercise the real exported `reclaimFinishedLanes` with an injected recording reclaim callback. Run identical assertions against the original module and an isolated mutant that removes BOTH forwarded component properties from the `isLaneAlreadyClean` call. Locate that call and require exactly one matching mutation site; zero or multiple matches fail rather than silently skipping proof. Removing one property alone is not the regression: the predicate rejects a missing counterpart while either component remains supplied.
3. **Honest mutation verdict:** use a uniquely named temporary sibling module so relative imports resolve, never overwrite the tracked source, and always remove the temporary file in a finally block. Importing the sibling must leave its CLI main-module guard false. Require successful import and successful baseline assertions before attempting the mutant. A mutant counts as killed only by the expected reclaim-call/outcome assertion for cancellation; a syntax/import error, timeout, or unrelated exception is a guard failure. An unchanged-source control must survive, proving that arbitrary failures are not accepted as kills.

The scoped mutation option fulfills the review's explicit coverage-or-mutation alternative. It does not change global coverage thresholds or the underlying lane preservation policy.

## MVP

- Add the prevention suite and its explicit lint dependencies. Preserve the existing cancellation regression in `we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs`.
- Pin both outcomes in the prevention suite: zero components at the correct branch tip skip reclamation; cancelling nonzero components at that same tip call reclaim once and return the injected result. Also cover the reversed cancellation pair (+2, -2).
- Make the lint negative control and the removal mutant executable parts of the normal test run, not manual instructions that can be forgotten.
- Keep all callbacks fake; no pool scan, lease change, live reclaim, GitHub operation, or daemon invocation is necessary for these guards.

## Test plan

- Existing source/test pair: `we:scripts/conveyor/lane-pool-health-watch.mjs` → `we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs` plus planned `we:scripts/conveyor/__tests__/lane-pool-health-watch-prevention.test.mjs`.
- Dependency/config pair: `we:package.json` and `we:package-lock.json` → the planned prevention test's actual ESLint/globals imports and lint controls; verify installation with `npm ci` in the implementation checkout.
- Linter cases: unchanged source passes; an undeclared forwarded identifier produces `no-undef`; a legitimate local/import is accepted; invalid syntax is rejected; inline suppression cannot hide the negative control.
- Mutation cases: baseline assertions pass; removing both components is killed by the cancellation assertion; unchanged-source control survives; missing/ambiguous mutation anchors fail; load errors are rejected rather than credited; temporary files are removed on success and failure.
- Run `npx vitest run lane-pool-health-watch` to collect the existing watcher suites and the new prevention suite. Run `npm run check:standards` during implementation validation. Confirm CI collects the new file through the existing shard path.

## Proof plan

Record baseline and negative-control evidence from the implementation checkout. First show the unmodified watcher passes both new guards. Then, in disposable source copies only, introduce the undeclared identifier and record the exact `no-undef` diagnostic; remove both component arguments and record the named cancellation assertion failure. Record that a no-op mutant is rejected as surviving and an import failure is rejected as invalid evidence. Finally run the complete affected suites with the original source and show a clean result and no leftover mutant files.

The substantive red/green evidence is the two controlled defects above: each guard must reject its defective copy and accept the original. The pre-implementation tree has no prevention suite; record that absence rather than claiming a test that does not exist already fails. Do not present the already-green cancellation regression alone as proof that this prevention debt is delivered.

## Done when

`npx vitest run lane-pool-health-watch` passes with both guards collected, and its prevention suite demonstrates a real no-undef diagnostic and a killed component-removal mutant with the specified failure attribution. The existing CI shard route runs those tests, dependency installation is reproducible, and implementation validation records the controlled red/green evidence.

## Follow-ups

No prerequisite judgment call remains. Repository-wide lint adoption, broader mutation testing, and a changed-branch coverage policy are separate work if requested; this item establishes only the two guards owed for the reviewed watcher change. If the call site is refactored later, update the mutation anchor and preserve its fail-closed missing/ambiguous-site checks and cancellation proof.
