---
bornAs: xgjjvai
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs", "we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs", "we:scripts/pr-land.mjs", "we:scripts/__tests__/pr-land.test.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "70a302401313c4ac57bd86b12e9cd44aea1a32ab"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3033's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/__tests__/review-escalation.test.mjs:2835` — Extract the drain's verdict-decoration and pr-land's rubric-input assembly into pure functions, then test them by behaviour. A lint could also flag `readFileSync(...src).toContain(` wiring assertions.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3033@d80b906afed512c7b1403e09025b64d751ef9382

## Done when

1. The drain's body-to-verdict deviation propagation and the producer's body-to-rubric assembly are covered by executable behaviour tests, replacing the deviation source-text wiring assertion.
2. Tests fail when deviation propagation is removed from either production path, and pass with the implementation restored. Existing trusted, head-bound clearance semantics remain intact.
3. The focused suites in the Test plan and `npm run check:standards` pass. No review policy or clearance rule changes are required.

## Progress

- Original premise/scope: the advisory cited the wiring assertion at the former line 2826 of `we:scripts/lib/__tests__/review-escalation.test.mjs` and scoped only that test, while asking for drain decoration and producer input extraction.
- Corrected premise: the assertion now starts at `we:scripts/lib/__tests__/review-escalation.test.mjs:2835`. The drain already exposes `buildDrainVerdicts` in `we:scripts/merge-ai-prs.mjs:1584`; body decoration remains inside it at line 1631. Its existing behavioural fixture lives in `we:scripts/__tests__/merge-ai-prs.test.mjs` under the `buildDrainVerdicts` describe. Reuse this callable boundary rather than extracting another decorator solely for testing.
- Partial delivery already exists: `readDrainAcceptance` and `decideDrainReviewGate` in `we:scripts/merge-ai-prs.mjs:561` and `we:scripts/merge-ai-prs.mjs:596` read trusted clearance and compose the gate. `we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs:606` already tests park → trusted clearance merge → untrusted author park. This does not test body-to-verdict propagation or producer input assembly, so the goal is not already done.
- Remaining producer evidence: `we:scripts/pr-land.mjs:1004` onward assembles net-diff signals, manifest metadata, current labels and parsed body inline before calling `resolveProducerReviewLabel` at line 1032. The exported scorer at line 586 accepts an already-parsed deviation; existing tests therefore cannot detect a dropped body parse in the producer.
- Corrected scope: include both production modules and their matching existing tests, plus the original shared review test for removing the brittle assertion. No shared scoring-policy implementation change is needed. Preparation is based on direct source inspection; no implementation or test execution is claimed here. Stamping and checks remain runner-owned.

## Design

Preserve the existing policy and extract only the producer's deterministic input assembly. Add an exported pure `buildProducerReviewInputs({ signals, manifest, currentLabels, body })` in `we:scripts/pr-land.mjs`, returning the complete argument object consumed by `resolveProducerReviewLabel`. Pass through changed files, own and cumulative line counts, human-basis files and nullable diff hunks. Preserve current finite-number coercion for dismissed findings, multi-repository detection, and `signals.scored ? signals.basisNarrowed !== false : true`. Parse deviation from the supplied raw body with the existing parser. Keep Git, forge reads, label writes and roster reconciliation outside the function. Route the production call through this function using the already-read values.

For the drain, test the existing `buildDrainVerdicts` boundary in `we:scripts/__tests__/merge-ai-prs.test.mjs` with in-memory PR listings and injected `readOf`. Feed its actual deviation output into `decideDrainReviewGate` using the acceptance fixture in `we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs`. Preserve the current distinction between body disclosure and independently trusted clearance evidence.

Replace the deviation wiring-source assertion in `we:scripts/lib/__tests__/review-escalation.test.mjs` with this behavioural coverage. Keep parser, score, forged-clearance and delivery-brief contract tests; the brief assertion tests an authored instruction, not executable wiring. Do not expand this item into a repository-wide source-assertion migration.

## MVP

1. Extend drain fixtures to observe parsed deviation from the real verdict builder, including absent disclosure and malformed/empty disclosure.
2. Extract producer input assembly and route the production scorer through it; add tests in `we:scripts/__tests__/pr-land.test.mjs` that assert the full assembled object and resulting review label.
3. Exercise the produced drain deviation through the existing injected acceptance reader/gate fixture, then remove the superseded source-text assertion from `we:scripts/lib/__tests__/review-escalation.test.mjs`.
4. Deliver as one behavioural refactor with regression tests. No new runtime module, policy switch, network-dependent test or lint rule is required.

## Test plan

- `we:scripts/merge-ai-prs.mjs` → `we:scripts/__tests__/merge-ai-prs.test.mjs`: first-line disclosure survives verdict building; leading blanks are accepted; absent/later-line disclosure produces null; empty disclosure stays fail-closed; sanitised comment delimiters cannot become clearance evidence.
- `we:scripts/merge-ai-prs.mjs` → `we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs`: pass the verdict's deviation to the real gate composition; absent, stale and forged clearance park, while trusted matching-head clearance merges. Preserve unreadable-evidence deferral coverage.
- `we:scripts/pr-land.mjs` → `we:scripts/__tests__/pr-land.test.mjs`: assert all input fields, null diff hunks, scored/unscored basis handling, absent/malformed manifest metadata, numeric dismissed findings, cross-repository detection and current labels. Compose the assembler with the scorer: disclosure requires human review and retains its reason; a clean small fixture without disclosure retains its existing label.
- `we:scripts/lib/__tests__/review-escalation.test.mjs`: preserve existing parser/scorer/gate tests and remove only the superseded deviation executable-source assertion.
- Run the four test files listed above with Vitest from the WE working directory. A broader executable regression command selecting the relevant test names is:

```bash
npx vitest run -t 'deviation|buildDrainVerdicts|buildProducerReviewInputs|resolveProducerReviewLabel'
npm run check:standards
```

## Proof plan

Record the focused command's actual result during implementation. Demonstrate failure by temporarily dropping deviation assignment in `we:scripts/merge-ai-prs.mjs` and separately returning null deviation from the new producer assembler in `we:scripts/pr-land.mjs`; each matching behavioural test must fail, then pass after restoration. Also mutate one cumulative signal mapping to prove the full producer input assertion catches assembly drift. Keep mutations out of the delivered diff.

Review the production call site to confirm it consumes the tested assembler with the real body and net-diff result; pure helper tests alone do not prove that connection. Record this inspection separately from executable test results. All tests use injected reads or pure inputs and require no live PR mutation.

## Follow-ups

The advisory's optional lint against executable-source string assertions is not required for this prevention guard. A broader lint would need to distinguish legitimate authored-text contracts from brittle executable wiring checks; leave that separate from this bounded behavioural refactor. No blocking design fork remains for the extraction and tests described here.
