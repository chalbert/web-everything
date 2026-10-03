---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "e2ca80ac2a75e42cb204b6d736bdf55bf87f5e38"
tags: []
---

# Prevention — A deterministic test scenario that injects a concurrent label addition exactly during the gh pr edit ex… (from chalbert/web-everything#3475 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/ci-heal-mark.mjs:250` — A deterministic test scenario that injects a concurrent label addition exactly during the `gh pr edit` execution window to assert how the script recovers or reports the breach.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3475@442a00342e7fa9abb130bc1e62ff88283453c0a0

## Progress

Preparation research: the original premise cited the edit window at
`we:scripts/conveyor/ci-heal-mark.mjs:186` and scoped both the production script and
`we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs`. The goal remains an executable
concurrent-label regression scenario. The corrected location is
`we:scripts/conveyor/ci-heal-mark.mjs:250`: the mutation is followed by verification
at lines 251–256 in that same source. The source/test scope remains paired, but the
expected implementation diff is test-only; production behavior already reports the
breach and does not recover by removing either label.

Evidence: `we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs:328` defines concurrent
review-label cases, but the fake CLI injects them on the second **view** at line 361,
before the edit. Its post-write case at line 337 changes the head on a later view;
the edit handler does not inject a concurrent label. Thus existing coverage does
not deliver this item's exact timing. The reporting paths are
`we:scripts/conveyor/ci-heal-mark.mjs:287` (best-effort normal hand-back) and
`we:scripts/conveyor/ci-heal-mark.mjs:323` (restore-only failure). These findings are
from source inspection, not a claim that the proposed cases have run.

## Design

Extend the existing stateful fake-`gh` incident replay in
`we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs`. Add an explicit scenario field
for a label injected inside the `pr edit` handler, after its requested additions
have been applied and before the state is persisted and the command returns.
Keep the pre-edit reads unlabelled, the head unchanged, and the PR open and non-draft.
This deterministically places the competing write between the final guard read and
the verification read, without sleeps, network access, or production injection hooks.

Exercise `review:human`, `review:changes`, `review:accepted`, `review:unknown`, and
`ready-to-merge` separately in both normal completion and `--restore-routing-only`.
Persist the competing label alongside `review:pending`; assert raw final state
before the existing simulated lifecycle cleanup. A benign unrelated label is a
positive control: it must survive and must not trigger a verification error.

The established behavior in `we:scripts/conveyor/ci-heal-mark.mjs` is reporting,
not rollback. Normal completion preserves its durable heal comment and exits zero,
with no `restored` field and `carryReason` equal to
`CI-heal routing restoration could not be verified`. Restore-only exits one,
reports that error on stderr, and posts no restoration-success comment. Neither
path removes the competing label, retries the edit, or restamps acceptance.
No interface, label policy, or persistent-data migration is needed.

## MVP

1. **Must 1 — Deterministic injection:** add edit-window fixtures to
   `we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs`, covering the five conflicting
   labels and one benign label in both CLI modes. Record enough call/state evidence
   to show the final pre-edit read was clean and injection happened in the edit handler.
2. **Must 2 — Exact observations:** assert exit status, JSON or stderr diagnostics,
   raw final labels, comment contents/counts, and exactly one additive edit with no
   removals for each edit-window case. Conflicting cases retain both labels and
   never claim restoration success; the benign case reports successful restoration.
3. **Must 3 — Preserve existing coverage:** retain pre-edit refusal, write failure,
   ignored-write, and post-write head-change cases. Adjust scenario expectation
   branching explicitly so new edit-window cases are not mistaken for skipped writes.

Implement fixtures first, then assertions and expectation branching, and land them
as one test-only change. Size 3 remains appropriate for the existing subprocess
harness, two output contracts, and mutation-sensitive assertions. The production
source remains in scope as the behavior under test, paired with its existing test.

## Done when

1. Musts 1–2: the focused incident replay runs all edit-window cases in both modes,
   proves their injection ordering, and asserts the existing reporting contract and
   preserved concurrent labels.
2. Must 3: the complete matching test file passes with existing scenarios intact.
3. Must 2: disabling the conflicting-label post-write check makes the new conflicting
   cases fail; restoring that check returns them to green. This is a coverage addition:
   the current production code is expected to pass the new tests, so no unmodified
   baseline failure is claimed.

## Test plan

Run the incident replay in `we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs`
with Vitest's test-name filter `CI-heal missing routing label incident replay`, then
run that full test file. Invoke Vitest from the WE checkout using the filesystem
path corresponding to the prefixed reference. Include the benign-label control
so a verifier that rejects every concurrent addition cannot satisfy the suite.
Keep all PR state and fake executables in each test's existing temporary directory.

For normal conflicting cases assert exactly one heal marker comment, no restoration
success, `restamped: false`, `rearmed: false`, and the exact `carryReason`. For
restore-only conflicting cases assert status one, the verification error in stderr,
no success JSON and no comments. For benign cases assert `restored: review:pending`
and the mode-appropriate heal or restoration comment. Check every fake command
still addresses the fixture repository and that no real GitHub call escapes the fake.

## Proof plan

Save the focused and full-file test results plus representative command traces and
final fixture state for both modes. Temporarily disable only the conflicting-label
predicate at `we:scripts/conveyor/ci-heal-mark.mjs:255` in an isolated validation copy;
the new conflicting cases must fail on their reporting assertions while the benign
control remains green. Restore the predicate and rerun the focused cases. Record
this as mutation evidence, not as proof of an atomic GitHub write or automatic recovery.

The runner owns preparation checks and stamping. During implementation, run the
repository standards gate and verify the final diff contains only the intended test
change and no retained mutation. Independent review of this preparation belongs to
the runner's parked review flow.

## Follow-ups

No prerequisite or unresolved policy fork remains for this coverage-only goal.
Automatic reconciliation of the resulting mixed labels would require a separate
policy decision about competing writers; this item only locks down the existing
breach reporting. A real remote race experiment is unnecessary for deterministic
coverage and is not part of this item.
