---
bornAs: x0bbh38
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "bc2b51e50a781b4ab6e1840d64121052aedc6b19"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2991's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. Preserve executor attribution when a claim and a durable run record describe the same item; cover the complete daemon-to-policy path.
2. Guard each provider's below/at/above-cap behavior, including independence when the other capacity pool is full.
3. Guard the daemon's emitted stdout tick JSON against silent changes to existing field types.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2991@e829553edb1b8ab621ccf4df8fdef4f86286c134

## Done when

1. The focused Vitest run covering `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` and `we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs` passes with all three prevention guards below.
2. Deliberately dropping executor during deduplication, coupling the two capacity pools, or changing stdout `inFlight` back to bare numbers each fails the corresponding new regression test. Record these mutation failures and the restored passing run as delivery evidence.

## Progress

Preparation research (2026-10-02; no stamp):

- **Old premise/scope:** the review cited a broken daemon merge at `we:skills-src/conveyor/build-dispatch-daemon.mjs:268`, a contradictory acceptance example in `we:backlog/4531-split-build-dispatch-concurrency-cap-by-provider-claude-vs-c.md:19`, and an unguarded stdout shape. Scope included the sibling card and only the daemon test file.
- **Corrected premise:** commit `26f32afdd` already delivered the provider split and executor-preserving policy merge. The daemon now collects claim and run evidence at `we:skills-src/conveyor/build-dispatch-daemon.mjs:365-379`; deduplication is in `we:scripts/conveyor/build-dispatch-policy.mjs:220-225`. A direct local invocation of `planBuildDispatch` with duplicate claim/run rows returned one entry with executor `codex`, unioned scopes, and busy count 1. Do not reimplement that merge.
- **Existing coverage:** `we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs:366-403` covers default-cap boundaries, independence in both directions, shared external slot consumption, unknown executors, and duplicate evidence in either order. It does not provide the requested full parameterized below/at/above matrix. `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:173-186` covers a run-store row alone, without a matching claim; its route/cap tests begin at line 1951.
- **Remaining stdout guard:** the live `onTick` callback serializes inline at `we:skills-src/conveyor/build-dispatch-daemon.mjs:1471-1477`. The daemon tests contain no stdout tick snapshot/contract assertion. This debt is therefore only partly delivered, not already-done.
- **Corrected scope:** retain the daemon source and its matching existing test; add the existing policy test file. Remove the sibling card from edit scope: its Prep already corrects the arithmetic (four external builds fill a cap of four). The policy implementation is evidence, not a planned change. Preserve the original three prevention goals without changing routing or capacity policy.

## Design

Use the existing policy merge as the single deduplication implementation. Add a daemon regression that supplies a real temporary claim and a run-store row for the same normalized item number, then exercises `runBuildDispatchTick` with injected effects. Assert one merged entry, retained executor, unioned scope, and no redispatch of that item.

Extend the existing policy suite with a table over candidate executors `claude`, `codex`, and `antigravity`, own-pool occupancy at cap minus one, cap, and cap plus one, and other-pool occupancy empty or full. Codex and Antigravity share the external pool; unknown executors continue to consume Claude capacity. Use disjoint scopes, prepared candidates, no open PRs/freeze, and a sufficiently high own-item WIP cap so unrelated gates cannot mask the concurrency assertion.

For stdout, extract the existing serialization/write operation into an exported helper in `we:skills-src/conveyor/build-dispatch-daemon.mjs`, used by the live callback, with injectable writer and time. Preserve the current JSON projection exactly. Add an inline snapshot in `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` using fixed time and representative tick results. This is a test seam for the existing output contract, not a new schema or output format. Assert exactly one newline-terminated JSON record and parse the captured bytes; do not snapshot a separately reconstructed imitation of the payload.

## MVP

1. Add the daemon duplicate-evidence regression for known executors and a legacy row without executor, retaining existing retirement and in-flight hold behavior.
2. Add the provider boundary matrix alongside the existing policy examples; preserve the existing within-tick shared-external-slot test.
3. Extract and wire the stdout writer; snapshot populated and empty tick output, including `inFlight` objects with string `num` and string-or-null `executor`. Cover current fields `at`, `status`, `freeze`, `openItems`, `dispatched`, `prepare`, `hold`, `dispatchHolds`, `failures`, `retired`, `infraRetry`, `orphanAdoption`, `draftRecovery`, `holdRouting`, and `holdRoutingResult`, preserving current null values and JSON omission of undefined properties. Include successful and error-shaped optional pass results.

## Test plan

- `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`: use the existing temporary claim/effects harness, keep the duplicate item live in the fixture, and verify the merged plan rather than just the run-store reader. Assert the expected capacity pool is charged once.
- `we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs`: parameterize the 3 × 3 × 2 boundary matrix above. Below cap dispatches; at/above cap holds with rule `cap`, regardless of the other pool. Exercise both default and custom cap values, mixed external occupants, and the existing conservative unknown-executor behavior.
- `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`: capture the production writer's bytes with deterministic time and inline snapshots, including empty/populated `inFlight` and null executor. Ensure the live callback calls this tested writer. No live daemon, GitHub calls, or real dispatch is needed.

## Proof plan

Run the two focused Vitest files named above from the WE checkout, then `npm run check:standards` during implementation verification. Preparation itself leaves these checks to the runner.

Demonstrate sensitivity with temporary mutations during implementation: remove executor retention from the policy merge and observe the duplicate-evidence regression fail; charge external occupancy to Claude and observe matrix failures; serialize `inFlight` as bare item numbers and observe the stdout snapshot fail. Restore each mutation and rerun the focused suites. A new prevention test may pass immediately against already-correct behavior; mutation failure supplies the missing red evidence without inventing a current production defect. Review the final diff to confirm the live callback uses the tested writer and no stdout keys or types changed.

## Follow-ups

No additional policy decision or child item is needed. Future intentional tick-output changes must update the output contract test with review of compatibility. Broader daemon-output versioning, routing changes, and cap-default changes are outside this prevention item.
