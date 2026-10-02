---
bornAs: xupbp7k
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/daemon-boot-smoke.mjs", "we:scripts/lib/daemon-boot-watchdog.mjs", "we:scripts/lib/__tests__/daemon-boot-smoke.test.mjs", "we:scripts/lib/__tests__/daemon-boot-watchdog.test.mjs", "we:scripts/lib/__tests__/daemon-boot-watchdog-live.test.mjs", "we:scripts/lib/__tests__/daemon-boot-smoke*.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "40b096c74de9da9974cc52a46a1a85d26e7baa9a"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2965's independent review

Filed mechanically on approval of chalbert/web-everything#2965. Preserve the seven prevention obligations: actual-root containment, explicit test-only override gating, safe file URL construction, framed harness results, termination despite imported open handles, spawn-error handling, and concurrent watchdog history coverage.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2965@5e30dce287c23b814ee16eb2f830e46efd64eebe

## Progress

Preparation research (unstamped): the original scope named the two implementation modules and their unit tests. Its smoke citations at lines 95 and 178 no longer identify the containment and override implementations precisely. Current evidence is `we:scripts/lib/daemon-boot-smoke.mjs:97` (`resolveDaemonEntries`), `we:scripts/lib/daemon-boot-smoke.mjs:123` (`isSafeRelativeEntry`), `we:scripts/lib/daemon-boot-smoke.mjs:138` (`buildEntryBootScript`), and `we:scripts/lib/daemon-boot-smoke.mjs:181` (`checkDaemonEntriesBoot`). These mechanisms have not moved to another module.

Observed with a read-only Node probe: the validator accepts a relative traversal through a sibling directory bearing its fixed marker name, although resolving that same input against an actual candidate root escapes the candidate. A comma-only `WE_SMOKE_DAEMON_ENTRIES` value also returns `ok:true` with zero entries and no child invocation. The goal is therefore not already delivered.

The corrected scope adds the existing `we:scripts/lib/__tests__/daemon-boot-watchdog-live.test.mjs` and permits matching smoke guard tests. The live suite already proves sequential crash-loop rollback and CLI behavior; it does not exercise parallel state writers. `we:scripts/lib/daemon-boot-watchdog.mjs:92` keys history by clone, `appendBootAttempt` performs an unlocked read/modify/write, and `defaultSpawn` listens only for exit. Existing timer-cleanup tests cover the watchdog timer, not open handles left by an imported smoke entry.

Compatibility evidence: `we:scripts/lib/__tests__/daemon-live-smoke.test.mjs:949` and `we:scripts/conveyor/soak/breaks/daemon-entry-boot-crash.mjs:87` use the environment override to inject a deliberately failing TDZ fixture. Preserve that diagnostic use without allowing any override to certify a production candidate. `we:scripts/lib/bounded-child.mjs` already bounds children and handles spawn errors; it need not change. Repository-wide lint proposals in the original review are broader than this card's two-source scope; retain them explicitly as follow-ups, with local executable regression guards delivered here.

## Design

1. In `we:scripts/lib/daemon-boot-smoke.mjs`, resolve each entry against the actual absolute candidate directory converted with `pathToFileURL`, including its directory separator. Validate the resolved file URL against that directory, reject absolute/scheme inputs and escapes, and pass the validated URL into the generated child script. Do not validate against a synthetic marker and then resolve again against a different base. Cover URL encodings and directory-boundary collisions; this is URL/path containment, not a new symlink sandbox.
2. An active environment entry override may still run diagnostic fixtures, but its result must always be `ok:false` and explicitly say that the real list was bypassed, including when every fixture succeeds or the parsed list is empty. Retain individual import-error detail for existing TDZ callers. Add an explicit injected `entries` argument for direct unit/fixture tests; it is not populated from environment by the production check row. Reject an empty injected list. The default check always tests all `DAEMON_ENTRY_MODULES`.
3. Keep one cold child per entry. Emit a distinctly prefixed, newline-delimited terminal result, after arbitrary import-time logging; parse exactly one valid result frame and require a boolean `ok`. Missing, duplicate, malformed or truncated frames fail closed. Flush the frame before explicitly exiting the disposable harness so an imported interval cannot hold it open. Retain the parent's hard timeout for imports that never settle and the split dynamic-import token required by the import scanner.
4. In `we:scripts/lib/daemon-boot-watchdog.mjs`, settle the child outcome once on either spawn error or exit. Record spawn failure as a failed attempt with diagnostic detail, never as boot-confirmed survival; clear the survival timer on all paths. Pin this with a real missing-executable test as well as injected outcomes.
5. Keep the existing clone-wide state contract. Add the review-requested parallel failing-watchdog test against one scratch clone and state directory, asserting complete persisted history and guard activation on the next start. If it exposes lost updates, serialize state read/modify/write operations using the existing reservation primitives in `we:scripts/readiness/file-locks.mjs`, with bounded contention handling and guaranteed release, and publish complete JSON atomically. Do not silently discard a failed persistence operation. Entry-scoped history is not required to meet this obligation and would change the existing aggregation contract.
6. Add focused source-regression assertions in `we:scripts/lib/__tests__/daemon-boot-smoke-prevention.test.mjs` (planned) for manual file-URL concatenation and synthetic containment bases, alongside behavioral tests. Keep these guards scoped to the named module; do not represent them as a general JavaScript linter.

## MVP

Deliver the six design steps as one tested change to the two scoped source modules and matching tests. Update their comments to describe actual-root resolution, framed output, explicit termination, diagnostic-only environment overrides, and observed spawn failures. Preserve production entry inventory, cold process isolation, timeout budgets, clone-wide rollback target selection, and the existing no-known-good refusal behavior.

Use the existing live watchdog suite for concurrency proof and the existing smoke suite for real import fixtures. No production launcher wiring, daemon restart, new standard entity, or changes to the shared child runner are needed.

## Test plan

- `we:scripts/lib/__tests__/daemon-boot-smoke.test.mjs`: real candidate roots containing spaces, percent and hash characters; marker-name traversal, encoded dot segments, absolute/scheme paths, sibling-prefix collisions, valid nested entries; rejected entries spawn no child. Test unset, blank, comma-only, successful-fixture and failing-fixture overrides, plus explicit nonempty fixture injection and the full default inventory.
- `we:scripts/lib/__tests__/daemon-boot-smoke-prevention.test.mjs` (planned): table-generated containment cases and the scoped source guards. Real imported fixtures log before returning or throwing and leave an interval open; the harness returns the correct frame and exits before its hard timeout. Missing/duplicate/malformed frames remain failures. Ensure stdout flush is observed, not inferred from a call to exit.
- `we:scripts/lib/__tests__/daemon-boot-watchdog.test.mjs`: error/exit races settle once, failed spawn cannot confirm boot, timer cleanup remains intact, persistence failure is visible, and existing history/rollback cases remain green.
- `we:scripts/lib/__tests__/daemon-boot-watchdog-live.test.mjs`: use multiple separate supervisor processes with a coordinated start against one scratch state directory, below the history cap; assert every completed failure survives persistence and the next start trips the guard. Bound all processes and clean them up in finally blocks. Retain real scratch-git rollback and self-heal coverage; include a child whose executable cannot be found.
- Compatibility check: run `we:scripts/lib/__tests__/daemon-live-smoke.test.mjs` to confirm its TDZ override still reports the actual import failure. Inspect the soak break's expected failure detail in `we:scripts/conveyor/soak/breaks/daemon-entry-boot-crash.mjs` against the same result contract.

## Proof plan

Before implementation, run the new focused regressions against the current source and retain failure output for marker traversal, zero-entry override success, noisy/open-handle imports, and unhandled spawn error. Record whether the coordinated concurrency test reproduces lost updates; do not call a probabilistic green run proof of atomicity. Validate the read/modify/write exclusion with a deterministic contention case if serialization is needed.

After implementation, run Vitest over the scoped smoke and watchdog test files and the live-smoke compatibility suite (all paths above are WE-relative execution targets). Capture exit status, test counts, frame results, persisted attempt count, rollback target and scratch HEAD before/after. Run `npm run check:standards`. All process and git mutation proof uses disposable scratch directories, never a running daemon or this lane's HEAD. These are delivery checks; this preparation does not claim they have passed. The runner owns preparation stamping and checks.

## Done when

The focused regression command fails on the current implementation and passes after delivery; the full named suites and standards gate pass. Neither a traversal nor an environment-narrowed/empty list can certify a candidate; logging and open handles cannot corrupt or stall a completed import result; spawn failures are handled; concurrent failure records persist and trigger the existing crash-loop guard. Preserve red/green output as review evidence.

## Follow-ups

The original review also proposed reusable containment helpers, repository-wide rules against hand-rolled containment, environment-driven gate narrowing, manual file-URL concatenation and unhandled spawn errors, plus a common result/termination convention for all subprocess harnesses. These remain owed generalization work, not claims fulfilled by local source assertions. Inventory consumers and select the appropriate lint integration before broad rollout; in particular, `we:scripts/lib/daemon-live-smoke.mjs` has a separate dispatch harness and whole-stdout parser that this card does not migrate. No follow-up cards are filed during this preparation. Production watchdog launcher adoption remains separate from these prevention guards.
