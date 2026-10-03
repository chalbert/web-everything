---
bornAs: xo1k6ul
kind: story
size: 3
parent: "4075"
status: open
scope: ["plateau-app:src/backlog-view/proof-tiers.ts", "plateau-app:src/backlog-view/proof-tiers.test.ts"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "ea31c2743948fe56148e2fdc8d39b30f7a21e033"
tags: []
---

# Prevention — Add a sanitizer-design checklist item: emit the normalized, validated URL, not the raw input. Back it w… (from chalbert/web-everything#3375 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/3604-harden-the-proof-tiers-evidence-link-sanitizer-against-proto.md:42` — Add a sanitizer-design checklist item: emit the normalized, validated URL, not the raw input. Back it with a test that renders under a mismatched effective base.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3375@08163edfdb4f9bba087a3b059c04d0f00e762627

## Progress

- **Old premise/scope:** the approval follow-up pointed only at we:backlog/3604-harden-the-proof-tiers-evidence-link-sanitizer-against-proto.md:42, a design paragraph requiring preservation of accepted raw spelling. That is historical preparation text, not the sanitizer implementation or a regression test.
- **Corrected premise:** the same-origin guard and trusted-base forwarding have since landed in Plateau commit `decd689`. Inspection at Plateau HEAD `7b9547db7bd6d45f87e15d19b6b50a05890d238d` found clean scoped files. The private `safeHref` in plateau-app:src/backlog-view/proof-tiers.ts still returns `raw` after checking the parsed scheme and origin. Its public renderer escapes that raw value. The normalization prevention is therefore outstanding, not already delivered.
- **Source evidence:** plateau-app:src/backlog-view/proof-tiers.test.ts, under `renderEvidenceLink`, explicitly asserts preserved spelling for relative, fragment and default-port inputs. Its `renderProofBundle` test creates a document with the same base passed to validation. These assertions cover same-origin admission but miss resolution under a different effective base.
- **Observed probe:** imported the actual TypeScript module after in-memory transpilation and rendered `/proof` with trusted base `https://review.example/items/3604` into a happy-dom Window at `https://attacker.example/elsewhere/`. The emitted attribute was `/proof`; the resolved anchor was `https://attacker.example/proof`. No implementation files were changed. A separate probe using a base element changed `document.baseURI` but did not change happy-dom's resolved anchor origin; that emulator result does not prove browser base-element behavior. Use different Window URLs for the deterministic regression.
- **Corrected scope:** the deliverable is the sanitizer's local design checklist/API comments, normalized emission, and matching renderer regressions in plateau-app:src/backlog-view/proof-tiers.ts and plateau-app:src/backlog-view/proof-tiers.test.ts. The original WE card is historical lineage, not the implementation target. Keep this one product-repository delivery; no WE runtime or generic sanitizer abstraction is needed. Ownership follows we:docs/agent/platform-decisions.md#constellation-placement. The checklist lives beside the sanitizer it governs, so a cross-repository documentation prerequisite is unnecessary.

## Design

Add a sanitizer-design checklist to the existing sanitizer documentation in plateau-app:src/backlog-view/proof-tiers.ts:

1. Resolve against an explicit trusted HTTP(S) base supplied by application context.
2. Validate the parsed scheme and full origin; reject malformed URLs and invalid context.
3. Emit the normalized, validated URL (`parsed.href`), never the raw candidate or a separately reconstructed value.
4. HTML-escape the emitted value at the attribute boundary.
5. Test rendered anchors with an effective document base different from the validation base, checking both the attribute and the resolved destination.

Change only the successful branch of `safeHref` to emit `parsed.href`. Keep the private helper, required base arguments, forwarding through link/row/bundle, scheme/origin admission, and exact `#` rejection fallback. Update comments that promise raw spelling or require identical validation/rendering bases: trusted context remains mandatory, but admitted absolute destinations must remain stable across document-base changes. A fragment candidate becomes an absolute URL with that fragment; rejection `#` remains the existing local navigation fallback, not a disabled link.

This is the explicitly requested normalization correction, not a new host policy. Same-origin relative and absolute inputs remain admitted. Do not add external-host allowances or claim protection against subsequent server redirects.

## MVP

1. Add the five checklist items and revise the affected API comments in plateau-app:src/backlog-view/proof-tiers.ts before changing its success return.
2. Add the mismatched-document regression in plateau-app:src/backlog-view/proof-tiers.test.ts and observe failure with the current raw return.
3. Return the validated URL serialization and update the existing raw-spelling assertions to canonical destinations. Preserve the escaping, accessible-name, tier, bundle ordering, invalid-context and rejection coverage.

## Test plan

The existing matching test for plateau-app:src/backlog-view/proof-tiers.ts is plateau-app:src/backlog-view/proof-tiers.test.ts; both are in scope. Use its existing happy-dom environment from plateau-app:vitest.config.ts.

- Render root-relative, path-relative, fragment, same-origin protocol-relative and explicit-default-port evidence against `https://review.example/items/3604`. Assert the decoded attribute equals `new URL(input, trustedBase).href`, and the resolved anchor has exactly that destination.
- Mount rendered markup in a Window at `https://attacker.example/elsewhere/` while still passing the trusted review base to validation. Assert the fixture's actual document base first, then assert every admitted anchor remains at its validated review destination. Also exercise a different path on the same origin to catch path drift independently of origin drift.
- Exercise `renderEvidenceLink`, `renderProofBundleRow`, and a multi-tier `renderProofBundle`; assert every anchor individually so one good link cannot hide another raw relative value.
- Keep dangerous schemes, malformed candidates, missing/invalid base, deceptive hosts and cross-origin inputs rejected with the literal `#` attribute. Do not require fallback anchors to resolve to the trusted origin in the mismatched document.
- Update the escaping fixture to compare the DOM-decoded attribute with URL serialization, preserving query separators and preventing attribute injection. Retain labels and accessible names. Keep positive cases so an implementation returning `#` for everything fails.

From a writable Plateau implementation lane, run `npx vitest run proof-tiers`, which selects plateau-app:src/backlog-view/proof-tiers.test.ts. No real network navigation is required. Do not rely on happy-dom base-element handling as browser proof.

## Proof plan

Record the implementation base/candidate SHAs, exact focused command, exit codes and failing/passing assertions. First run the new mismatched-document test against the raw-return implementation (red); then run the complete focused suite with normalized emission (green). Temporarily restore only the successful return to `raw`: the mismatched-base/canonical-attribute assertions must fail while rejection behavior remains intact. Restore normalized emission and rerun green.

Review the local checklist against the implementation and tests: parsing, admission, serialization, escaping, and differing render context must each have explicit evidence. The preparation probe establishes the outstanding defect; it is not a claim that the future fix or a deployed review page has been tested. Runner-owned preparation checks and stamping remain outside this worker's actions.

## Done when

1. The sanitizer documentation contains the five design checks and no longer promises raw accepted spelling.
2. Every admitted evidence link emits the validated absolute URL and resolves to that destination under a mismatched document base; rejected links retain `#`.
3. The focused Plateau suite passes, and reverting normalized emission makes the regression fail. Existing admission, escaping, accessibility and bundle coverage remains green.

## Follow-ups

- When the review surface consumes these helpers, verify effective-base behavior in its actual browser environment, including a base element; the observed happy-dom limitation prevents using that fixture alone as browser evidence.
- A shared cross-repository sanitizer-authoring checklist can later cite this local checklist and regression. It is not required to deliver this bounded prevention.
- External artifact-host admission and redirect-chain enforcement remain separate requirements; normalization does not change either policy.
