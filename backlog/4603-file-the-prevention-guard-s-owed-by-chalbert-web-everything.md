---
bornAs: xrn1u1x
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "ac2e9dc86bcaf9c5f27bcc5a2091e11de598e967"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3087's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the five prevention obligations: isolated negative tests with mutation proof; per-PR evidence failure isolation; current-author liveness coverage; mechanically enforced partial-success accounting for sequential writes; and a guard against subprocess failures aborting independent-item loops.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3087@4468e1419a14944d40bf590928e091bae7491514

## Design

Keep the existing builder-only recovery policy and public adapter signature in `we:skills-src/conveyor/build-dispatch-daemon.mjs`. This is prevention work on the existing recovery path, not a new dispatcher or a repository-wide policy for arbitrary API calls.

1. In `cliRecoverBuilderDrafts`, wrap each PR's evidence collection in a try/catch **inside** the PR loop, from receipt/liveness lookup through candidate construction. Append `{ pr, action: 'error', error: String(error.message || error) }` for a failed PR; collect other candidates and invoke `recoverBuilderDrafts` normally. Return evidence-error rows followed by recovery rows. A failed evidence read must never create a candidate or consume a retry. Shared initialization failures remain tick-level errors; malformed check-run data and failed annotation/job-log reads are per-PR failures.
2. Preserve the independent current-author guard. Exercise the real adapter with a dead recorded PID wrapper and a different author stamp in the fetched PR body. For a live author, return a listing containing that session; for unknown liveness, make the listing unreadable. Use the existing stamp parser and liveness adapter, not a replacement Boolean predicate. A dead PID wrapper plus an unknown non-PID author is essential: the PID probe coerces results to Boolean, so returning null from that probe does not simulate unknown liveness.
3. Make exhausted-attempt escalation resumable at each successful write. Extend the existing PR-state JSON with optional `commentPosted` and `labelApplied` booleans. Pass current state and a persistence callback to the internal `effects.escalate` seam (additional arguments; existing injected effects may ignore them). After a successful comment, persist `commentPosted`; after a successful label, persist `labelApplied`; only then set `notified`. Retain attempts, pending metadata and handles in every checkpoint. The persistence callback must also update the in-memory state used by the final notified write, so that final write cannot overwrite the new flags with the pre-escalation snapshot. Retry skips recorded successes. Old state without these fields treats them as false; old `notified: true` remains terminal. Failed persistence must surface an error, never pretend the checkpoint succeeded. This provides durable accounting of acknowledged successes, not exactly-once delivery across an API-success/local-write crash window.
4. Add bounded deterministic structural checks in `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`, using the existing TypeScript parser dependency to inspect the recovery functions in `we:skills-src/conveyor/build-dispatch-daemon.mjs`. Require evidence API/subprocess calls (`api`, `paged`, `gh`, and any direct `execFileSync`/`runGhSync`) in the PR loop to be inside a per-iteration try with a catch that records an error row and allows continuation. A try surrounding the entire loop does not qualify. Require the known escalation comment/label sequence to have a persistence checkpoint between writes and after the second write. Fail if the target functions/calls disappear without updating the checker. Pair structural checks with behavioral fault injection; syntax alone cannot establish resilience. This scope addresses the review's two lint obligations on the actual affected path without claiming a general side-effect analyzer.

## MVP

- **Must 1:** Give every recovery eligibility/negative guarantee a fresh fixture and fresh temporary state directory where disk state is involved. Cover live/unknown authors, recent activity, absent/mismatched ownership, non-draft PRs, and absent/review-only current-head failures. Retain positive same-branch dispatch, freeze, hold ordering, retry-cap and pending-launch coverage.
- **Must 2:** Isolate per-PR evidence failures, return an identifiable error row, and still recover a healthy neighboring PR with no retry/state changes for the failed PR.
- **Must 3:** Add the real-adapter dead-wrapper/distinct-current-author matrix for true and unknown liveness, with a dead-author positive control.
- **Must 4:** Persist and reuse successful escalation substeps across adapter invocations, without falsely setting `notified` or spending a new repair attempt.
- **Must 5:** Add the two bounded structural rules, positive/negative rule fixtures and mutation proof. Implement these in the existing scoped test files; no new dependency or production lint framework is needed.

Land implementation and regression coverage together. Suggested order: isolate test fixtures; add failing fault cases; implement evidence catch and escalation checkpoints; add structural rule fixtures; run mutations and final validation.

## Test plan

Use `we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs` for behavior and `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` for structural enforcement and daemon integration. Both match the sole production source in scope, `we:skills-src/conveyor/build-dispatch-daemon.mjs`.

- Parameterize fresh adapter fixtures over each negative guarantee. Assert no dispatch/reservation/attempt write, and prove the same eligible fixture dispatches when just the rejecting input changes. Never reuse an exhausted/notified fixture for ownership assertions.
- Inject throws separately at PR fetch, commit fetch, check-run pagination, annotations, and fallback job-log execution; include malformed check-run responses. Run bad/healthy PRs in both orders. Assert an error row names the bad PR and the healthy PR dispatches exactly once. Repeat dry-run with no mutation and a planned healthy row.
- For distinct-author true/unknown cases, assert the PR body and liveness probes were actually consumed. Include false as a positive control. Keep all other eligibility inputs valid and old enough.
- Fail the comment: no label, no success checkpoint, retry posts both. Fail the label after a successful comment: disk records only comment success, next invocation retries only the label, and final state is notified. Verify a healthy second exhausted PR still escalates. Cover checkpoint-write failure and legacy state lacking new fields.
- Structural-rule fixtures must reject outer-loop-only catches, empty catches, unguarded nested job-log calls, and sequential writes without checkpoints. Accept the intended per-item catch/checkpoint shape. Comments or string literals containing guard text must not satisfy the checks.

## Done when

1. Musts 1 and 3 have independent negative cases that fail when their corresponding eligibility guards are removed, including the current-author guard and the receipt/PR-match guard.
2. Must 2's throwing-PR cases fail before the evidence-loop fix and pass after; a healthy neighbor is processed in the same invocation.
3. Must 4's partial-success test fails before checkpointing and passes after, including a new adapter invocation reading the persisted state.
4. Must 5's structural checks fail on unsafe source fixtures and deliberate guard/checkpoint removals, and pass on the implementation. No claim of repository-wide lint coverage is made.
5. Both scoped Vitest files and `npm run check:standards` pass after all temporary mutations are restored.

## Proof plan

From the WE checkout, run `npx vitest run` with `we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs` and `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` as arguments, stripping the documentation-only `we:` prefixes for execution. Record the test counts and exit status, then run `npm run check:standards`.

During implementation, record a red/green matrix: missing evidence catch; removed current-author guard; removed ownership guard; removed each remaining eligibility guard covered by Must 1; removed escalation checkpoint; outer-loop-only catch. Apply each mutation individually in a disposable source copy/checkout and show the named corresponding test fails for the intended assertion, not a syntax/import error. Restore all mutations and rerun the scoped suite. Structural fixtures can mutate source strings in memory. Stub forge/process/dispatch IO and use temporary state roots; no real PR writes or repair agents are needed for this regression proof.

Preparation evidence is source inspection, not a claim that these new tests or fixes have already run. The runner owns preparation checks, stamps and the parked review.

## Follow-ups

No additional implementation is required outside the declared scope. Generalizing the structural checks to unrelated side-effect loops is separate work requiring an inventory of those paths. The ambiguous remote-success/local-checkpoint crash window remains explicit; this card does not introduce remote idempotency or change retry policy. The distinct current-run handle issue tracked by #4616 remains separate from the current PR-body author-stamp tests here.

## Progress

- **Old premise/scope:** the approval receipt cited `we:skills-src/conveyor/build-dispatch-daemon.mjs:934`, `we:skills-src/conveyor/build-dispatch-daemon.mjs:1004`, and `we:skills-src/conveyor/build-dispatch-daemon.mjs:1010` for recovery writes/evidence; those locations have moved. The two test citations described a combined adapter test, and broad lint wording did not identify an enforceable boundary. Scope already contained the daemon and both matching test files.
- **Corrected premise/scope:** on inspected HEAD `ac2e9dc86bcaf9c5f27bcc5a2091e11de598e967`, recovery itself already has per-candidate error isolation at `we:skills-src/conveyor/build-dispatch-daemon.mjs:1127`; evidence collection starts at `we:skills-src/conveyor/build-dispatch-daemon.mjs:1189` without that protection, and job-log execution is at `we:skills-src/conveyor/build-dispatch-daemon.mjs:1220`. Sequential comment/label writes at `we:skills-src/conveyor/build-dispatch-daemon.mjs:1251` have no separate durable checkpoints. The scope remains the same three files; the mechanical checks are explicitly bounded to these recovery paths.
- **Source evidence:** `we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs:112` begins the combined adapter scenario; the manual-lookalike assertion follows exhaustion and can be masked by terminal state. The current-author guard exists at `we:skills-src/conveyor/build-dispatch-daemon.mjs:1198`, but the fixture supplies no current-author body stamp. `we:scripts/operations/dispatch-lane-io.mjs:827` supplies the real tri-state liveness semantics; `we:scripts/lib/review-independence.mjs:162` parses the author stamp. These are read-only dependencies, not additional edit scope. `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:60` supplies an existing source-guard testing precedent, and `we:package.json:123` declares TypeScript.
- **Next:** runner validation/stamping and independent parked review, then implementation against the five Musts. No production code, tests, stamps or status fields changed during this preparation.
