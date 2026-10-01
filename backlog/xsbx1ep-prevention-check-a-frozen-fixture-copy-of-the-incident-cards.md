---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/operations/probation-build-run.mjs", "we:backlog/4650-probation-runner-refuses-a-new-test-file-for-a-scoped-source.md"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Check a frozen fixture copy of the incident cards into __tests__/fixtures and clone only a synthetic re… (from chalbert/web-everything#3181 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/__tests__/probation-build-run.test.mjs:1056` — Check a frozen fixture copy of the incident cards into __tests__/fixtures and clone only a synthetic repo, or lint tests for reads of backlog/<num>-* paths.
2. `we:scripts/operations/probation-build-run.mjs:532` — Add a table-driven test of sourceTestPattern/missingTestScope covering config files and co-located tests, and decide explicitly whether they are exempt.
3. `we:backlog/4650-probation-runner-refuses-a-new-test-file-for-a-scoped-source.md:20` — Reword the Design to match the behaviour, or add a prepare test that dropping an original scope entry is refused.
4. `we:scripts/operations/probation-build-run.mjs:152` — Reject any scope glob in pathInScope or missingTestScope unless its prefix equals the basename of a scoped source. Add a table test with short-prefix and unrelated-prefix globs. Better still, a check:standards rule on card scope globs.
5. `we:scripts/operations/probation-build-run.mjs:433` — Anchor the match to the start of the trimmed message (`^\s*could-not-prepare\s*:`). Add a case to the misclassification table where the token appears mid-message.
6. `we:scripts/operations/__tests__/probation-build-run.test.mjs:812` — Extend the named regression with a card containing both preparation fields and assert that both are absent from the card sent to publication; run that assertion in the existing test gate.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3181@aa03bcdba02d2c8edc55f55b5af16bc02c9be9ac

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
