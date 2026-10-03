---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/__tests__/daemon-self-sync.test.mjs", "we:scripts/lib/review-core.mjs", "we:scripts/lib/__tests__/review-core.test.mjs", "we:docs/agent/delivery-loop.md"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "d8680b7e58e12912c899b2911e000b9e0daa5e0d"
tags: []
---

# Prevention — Review lens: a loop-repeat test must vary an input per iteration, or it should be a single test. A lint… (from chalbert/web-everything#3254 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/__tests__/daemon-self-sync.test.mjs:441` — Review lens: a loop-repeat test must vary an input per iteration, or it should be a single test. A lint gate is hard to write for this.
2. `we:scripts/lib/daemon-self-sync.mjs:590` — Review lens: flag parameters passed at a call site where the outcome is provably fixed. There is no cheap deterministic gate for this.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3254@b3da4f6c5d909cb537de256893ae6494cdf877b7

## Progress

Premise checked against the acquired checkout. The original scope named the daemon runtime and its tests, with historical review citations at we:scripts/lib/__tests__/daemon-self-sync.test.mjs:441 and we:scripts/lib/daemon-self-sync.mjs:590. The goal is to prevent two review blind spots, not to introduce a general static-analysis gate.

The repeated-test example remains at we:scripts/lib/__tests__/daemon-self-sync.test.mjs:446–453: each of 50 iterations creates a fresh default harness, never consumes `pass`, and asserts the same dispatch and rebuild count. The harness at we:scripts/lib/__tests__/daemon-self-sync.test.mjs:367–415 resets HEAD, origin, mocks, and output for each call. This is repeated coverage of one deterministic scenario, not evidence of 50 distinct moving-main interleavings.

The runtime citation now points to the HEAD-drift restart gate at we:scripts/lib/daemon-self-sync.mjs:589–590. Its `urgent: attempt > 0` argument can differ between attempts; the bounded loop starts at we:scripts/lib/daemon-self-sync.mjs:558 and the stale-recovery continuation follows a successful adoption. The later `urgent: true` call intentionally bypasses debounce during stale recovery. Neither is grounds for removing the parameter merely because its expression is constant at one call site. The second review lens remains owed, but this card must not assert an unproved runtime defect.

Corrected scope: retain the daemon test as a concrete cleanup, remove the daemon runtime from the edit set, and add the existing review-mandate builder and its matching test file. The shared mandate is built in we:scripts/lib/review-core.mjs:297, with rules composed at we:scripts/lib/review-core.mjs:324; panel and validator mandates derive from it. Existing coverage lives in we:scripts/lib/__tests__/review-core.test.mjs. The reviewer guidance in we:docs/agent/delivery-loop.md already discusses vacuous tests, but does not state either requested lens. This is not already delivered.

## Design

Add evidence-based review guidance to the shared mandate in we:scripts/lib/review-core.mjs and codify it beside the vacuous-test guidance in we:docs/agent/delivery-loop.md:

- For a repeated test, identify the input, persistent state, schedule, or seed that changes between iterations and the assertion that observes it. If every iteration recreates the same deterministic fixture, collapse it to one case. Do not reject stateful retry/idempotency tests or table-driven cases whose meaningful inputs differ.
- For an apparently redundant argument, trace the reachable caller conditions and callee use before reporting that the argument cannot affect the outcome. A literal argument alone is not proof. Preserve arguments that select intentional behavior, such as urgent restart bypassing debounce; do not demand speculative parameter removal.

These are review lenses within the reviewer's existing mandate, not new blocking seats, severity rules, or a heuristic lint gate. Existing review aggregation remains authoritative. Prompt coverage proves the instructions reach reviewers; it cannot prove that every future reviewer will apply them correctly.

Collapse the 50 identical fresh-harness runs in we:scripts/lib/__tests__/daemon-self-sync.test.mjs to one accurately named dispatch regression retaining both assertions. Keep the adjacent cases that vary imported changes, repeated refusal, quarantine, and lock refusal. No daemon runtime behavior change is required.

## MVP

1. Add the two review instructions to the shared mandate composition in we:scripts/lib/review-core.mjs, using its existing rule-composition pattern. Keep each instruction conditional on concrete evidence and the reviewer's lens.
2. Extend we:scripts/lib/__tests__/review-core.test.mjs to exercise the generated base, panel, and validator mandates and check both instructions and their exceptions reach those outputs.
3. Replace the duplicate-loop test in we:scripts/lib/__tests__/daemon-self-sync.test.mjs with one dispatch case, preserving the expected dispatched PR and two rebuild calls.
4. Add the concise reusable guidance to we:docs/agent/delivery-loop.md. Do not add a runtime parameter cleanup without a separately demonstrated defect.

## Test plan

The source/test pair is we:scripts/lib/review-core.mjs → we:scripts/lib/__tests__/review-core.test.mjs. The daemon cleanup directly edits its existing matching test, we:scripts/lib/__tests__/daemon-self-sync.test.mjs; the daemon runtime is read-only evidence.

Add mandate-output regression cases for both lenses and the required qualifications: changing persistent state is meaningful variation, and a constant literal is not proof of a fixed outcome. Exercise base, panel, and validator builders rather than asserting only against a disconnected rule constant. Check security-only output does not instruct the reviewer to exceed its own lens.

Run the affected Vitest files, passing the WE-relative forms of we:scripts/lib/__tests__/review-core.test.mjs and we:scripts/lib/__tests__/daemon-self-sync.test.mjs to `npx vitest run`. Run `npm run check:standards` during implementation. No live daemon, network, or production dispatch is needed.

## Proof plan

Before implementation, add the mandate-output regression cases and capture their failures against the current builder. After implementation, capture the same command passing. Remove each newly composed review instruction in turn: its corresponding output tests must fail, proving the instructions are wired into emitted mandates.

For the daemon test, temporarily break the successful retry's dispatched result or suppress its immediate rebuild; the single retained case must fail. Restore each mutation and rerun the affected suite. Report this as one deterministic scenario, not a soak or 50 independent interleavings.

Manually trace a positive and negative example for each lens: the fresh-default-harness loop versus the existing varying safety cases in we:scripts/lib/__tests__/daemon-self-sync.test.mjs, and a synthetic unused argument versus the intentionally urgent restart call in we:scripts/lib/daemon-self-sync.mjs. Record the reasoning without claiming a deterministic lint detector or guaranteed reviewer recall.

## Done when

- Both review lenses and their false-positive qualifications appear in generated mandates and the durable reviewer guidance.
- New mandate-output tests fail against the old builder and pass after the change; removing either instruction makes its coverage fail again.
- The daemon dispatch regression executes once, retains both behavioral assertions, and the adjacent varying cases remain intact.
- The affected suites and standards check pass; no runtime behavior or review blocking policy changes.

## Follow-ups

A general loop-analysis or constant-propagation lint gate is outside this item: neither was promised by the originating review. If later review evidence demonstrates another fixed-outcome call or an actual coverage gap, file the concrete case separately with its caller/callee proof. Do not manufacture input variation solely to retain a 50-pass test label.
