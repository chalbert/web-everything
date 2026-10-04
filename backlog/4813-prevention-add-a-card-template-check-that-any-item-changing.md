---
bornAs: xfhwbna
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs", "we:scripts/backlog/scaffold.mjs", "we:scripts/backlog/__tests__/scaffold.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "4a2606bc2f711efd86849e250db36b1b100a0fa4"
tags: []
---

# Prevention — Require an explicit error-policy Must for refusal or hold changes

Extend the existing card-template hint and authoring lint so a card changing a refusal or hold path states its fail-open versus fail-closed behavior on error in a Must line. Filed from the approval of chalbert/web-everything#3630; this is authoring prevention, not a change to any runtime's refusal policy.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3630@93b7557f58e7bea025516758509981fb89260f2a

## Progress

The original scope contained only the originating card, `we:backlog/4682-prevention-keep-the-registry-keyed-model-as-the-configured-w.md`, with a stale line-47 citation. That card now contains a prepared probation-evidence design, including hold parsing; it is context, not the implementation home for this check.

Corrected premise: prevention partially exists. `we:scripts/backlog/scaffold.mjs` exports GUARD_RELAXATION_HINT and appends it in renderItem. `we:scripts/check-standards-rules.mjs` implements findGuardRelaxationGaps and wires it into lintBacklogItemRendering as a warning for non-resolved cards. The current helper requires refusal-plus-loosening wording in one sentence, stops scanning at Design, Test plan or Progress, and accepts fail-closed/non-code anywhere in its scanned region. It neither covers general hold changes nor requires the decision in a Must line. Existing regressions live in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`; scaffold coverage lives in `we:scripts/backlog/__tests__/scaffold.test.mjs`. These two source/test pairs replace the original scope.

Observed with a direct Node import of findGuardRelaxationGaps: both “Change the hold path to parse each hold independently.” and “Loosen the refusal.” followed by ordinary prose saying “fail-closed and non-code” return an empty gap array. These are missing checks, not evidence of completion. The goal is not already delivered. Preserve the existing warning severity for prose heuristics; this item does not authorize choosing runtime policy or promoting a heuristic to a hard error.

## Design

1. Extend findGuardRelaxationGaps in `we:scripts/check-standards-rules.mjs`, retaining its existing relaxation check and named gaps. Add a distinct missing-error-policy-Must gap for refusal/hold changes. Detect a change verb (change, add, update, modify, replace, remove, relax, loosen, tolerate, skip, harden, or fix, including ordinary inflections) and a refusal term or “hold path/file/lookup/check” in the same sentence of the title, lead digest, or Must requirements. This is a bounded prose heuristic, not proof that all runtime changes have been discovered. Bare “hold a meeting” and mentions in historical Progress text must not trigger it.
2. Extract requirements independently of section order: accept list entries under a Must heading, numbered entries under a bold Must label within MVP or Explicit MVP cut, and individual list entries beginning with Must. Stop each block at its next peer heading/label. Ignore fenced examples and scaffold hints. Design/Progress prose must neither trigger nor satisfy the check; an MVP appearing after Design must still be read.
3. A satisfying requirement names fail-open or fail-closed (space or hyphen spelling) together with an explicit error/failure condition. Merely mentioning both alternatives, a question, or a TODO does not state a decision and must warn. Require a declared outcome for the affected path; allow multiple requirements for different paths, including an explicit conditional split with the conditions and outcomes stated. The lint checks authored evidence; review verifies that conditions match the code. It must not prescribe fail-closed for every hold path. Keep the existing stronger fail-closed and non-code obligation for refusal loosening.
4. Broaden the hint in `we:scripts/backlog/scaffold.mjs` to request an error-policy Must for every refusal/hold change and retain the second non-code-input Must for loosening. Exclude both the old exact hint and the new exact hint from lint input so existing scaffolds cannot satisfy or trigger the rule. The template should also tell the reviewer to check that the stated error outcome matches the changed path; this provides the requested review checklist at the authoring surface.
5. Integrate the new diagnostic through the existing lintBacklogItemRendering warning path. Keep resolved cards exempt and unrelated diagnostics unchanged. Diagnostic text must name the missing Must and give a concrete correction, without declaring which runtime policy the author must choose.

## MVP

**Must**

1. Warn when an authored refusal/hold change lacks a Must stating its behavior on error, including MVP sections following Design or Progress.
2. Accept explicit fail-open and fail-closed declarations for general path changes; retain the existing fail-closed/non-code requirements for refusal loosening.
3. Scaffold the broadened hint and review reminder, while ignoring both hint generations and fenced examples as evidence.
4. Preserve warning severity, resolved-card exemption and unrelated-card behavior. Only the two scoped source files and their existing tests are needed.

## Test plan

- **CAPABILITY**, `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`: missing-Must hold changes and non-loosening refusal changes warn; ordinary prose containing policy words cannot satisfy the new check. Cover every declared trigger family and both hold-file and hold-path spellings. These assertions must fail on the base helper.
- **CAPABILITY**, same test file: all three supported Must forms satisfy the new check, including MVP after Design/Progress; fail-open and fail-closed each work for general changes. TODOs, unanswered alternatives, quoted/fenced examples and bare policy tokens without an error condition do not satisfy it. Use paired missing/present fixtures so a never-triggering implementation cannot pass the positive cases. Include explicitly conditioned different-path outcomes.
- **CAPABILITY**, `we:scripts/backlog/__tests__/scaffold.test.mjs`: renderItem emits the broadened instruction plus reviewer reminder. Compose rendered cards with the real lint in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`: a missing-policy hold card still warns despite its hint, while an unrelated new card stays clean. Test the old exact hint too.
- **PRESERVATION**, `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`: retain refusal-loosening fail-closed/non-code gaps, warning-only integration, resolved exemption, unrelated text, historical Progress and fenced-content exclusions. Adapt old permissive fixtures to genuine Must requirements where necessary. Mutation proof: remove each exclusion or legacy requirement in isolation and observe the corresponding assertion fail; changing warning output into errors must fail the integration assertion.
- **PRESERVATION**, `we:scripts/backlog/__tests__/scaffold.test.mjs`: existing skeleton/frontmatter and Done-when ordering tests remain green. Mutation proof: omit the Done-when skeleton or move the hint before it and observe existing assertions fail.

## Proof plan

Run the two scoped test files with `npx vitest run`, supplying the repository-relative equivalents of `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` and `we:scripts/backlog/__tests__/scaffold.test.mjs`. First capture the new capability assertions failing against the base implementation; then run them after implementation and record passing results. Capture actual lintBacklogItemRendering warnings and errors for missing-policy, explicit-policy, unrelated and resolved fixtures to demonstrate the public integration, not just helper matching. Perform the targeted preservation mutations described above and revert each immediately. Finish with `npm run check:standards` and record exit status and any new warnings. Preparation probes establish the current gap only; the runner owns preparation checks and stamping.

## Done when

1. **Executable — Musts 1–4:** both scoped Vitest suites pass; the missing-Must hold-path regression fails against the base implementation, and the broadened scaffold assertion fails against the old template.
2. **Observable — Musts 1, 2 and 4:** the public card lint produces the missing-policy warning for an unqualified hold change, clears it for a genuine policy Must, and adds no errors or resolved-card warning.
3. **Review — Must 3:** the generated hint requests the policy declaration and non-code coverage where applicable, and explicitly asks the reviewer to compare the declaration with the changed error path. Standards checks complete successfully.

## Follow-ups

A prose check cannot infer semantic code changes or verify that a stated policy is correct; reviewers must inspect actual error branches and input classes. Automatic source-diff classification, corpus-wide remediation, a hard-error rollout, and changing probation hold/refusal behavior are outside this item. No runtime-policy decision is required to implement this bounded extension of the existing authoring warning.
