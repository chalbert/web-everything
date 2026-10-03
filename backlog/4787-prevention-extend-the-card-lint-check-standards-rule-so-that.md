---
bornAs: xcn6yhe
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "0fe94031929e42f8e18224faa60941a4afcadfe5"
tags: []
---

# Prevention — Extend the card-lint (check:standards) rule so that any card whose title or body contains 'refuses' or… (from chalbert/web-everything#3508 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. Originating card #4905 (now resolved) — Extend the card-lint (check:standards) rule so that any card whose title or body contains 'refuses' or 'guard' must carry a Must line for the on-error behaviour. The Test line must then include an unknown or error-state fixture.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3508@ab0f0503b4fb43ce8762d21e6eb4512f658dbe04

## Progress

- **Premise checked:** current checkout 0fe94031929e42f8e18224faa60941a4afcadfe5. The originating runner change is delivered, but this prevention rule is not: direct calls to `lintBacklogItemRendering` with open cards titled “Runner refuses stale input” and “Cache guard” produced no guard/error-fixture findings despite missing Must/Test evidence.
- **Old premise/scope:** extend an unspecified card lint by editing only the originating runner card; its cited line 12 is now the frontmatter delimiter, not the requirement.
- **Corrected premise/scope:** extend the existing pure rendering lint in we:scripts/check-standards-rules.mjs and its matching existing suite we:scripts/__tests__/check-standards-rules-content-lint.test.mjs. The origin card is evidence, not a deliverable. No runner change is needed.
- **Source evidence:** `findGuardRelaxationGaps` at we:scripts/check-standards-rules.mjs:964-990 requires refusal and relaxation words in one sentence, stops at Design/Test plan/Progress, and accepts fail-closed/non-code phrases without requiring a Must line. Its caller at we:scripts/check-standards-rules.mjs:1228-1236 emits warnings for unresolved cards. Existing preservation tests begin at we:scripts/__tests__/check-standards-rules-content-lint.test.mjs:784. The shared rendering lint is already called by the standards entry point at we:scripts/check-standards.mjs:919-935; no new entry-point wiring is required.
- **Preparation only:** no implementation, claim, stamp, or status change. Existing warning severity and resolved-card exemption are retained; this extends the live-card content check, not the definition of a failing standards gate.

## Design

Extend `lintBacklogItemRendering` with a separate guard-evidence check beside the existing relaxation check. Keep the latter's non-code caution requirement and existing tests intact. Use an internal helper so no new public export or export-registration edit is required.

Inspect the whole Markdown title/body, including sections after Design and Progress, for case-insensitive whole words `refuses` or `guard`. Follow the existing prose-lint convention of ignoring fenced code and the exact scaffold hint; the hint alone must not make every scaffolded card eligible. Do not add inferred synonyms or substring matches such as “guardrail”. Apply the same unresolved-card/warning boundary as the current relaxation check.

For a triggered card require two independently diagnosed pieces of authored evidence:

1. A Must line stating the on-error behavior. Recognize an explicit `Must` label (including bold/bullet/numbered forms), or an entry under a Must heading or Must-labelled list. Require an error/unknown/failure condition and a stated outcome on that entry, e.g. “Must refuse on unknown input” or “Must warn and continue on fetch error”. Do not impose refusal on intentionally warning-only operations. A bare “fail-closed” elsewhere is insufficient.
2. A Test-labelled entry, or a case entry under Test plan, naming an unknown/error/failure-state fixture and its expected result. For example: “Test: unknown-ref fixture; expect refusal before persistence”. A happy-path test, an unlinked mention of errors in Design, or “test errors” without a fixture and outcome is insufficient.

Implement this as documented lexical evidence checking, not semantic proof that a fixture exists or the behavior is correct. Keep evidence local to the entry (including its indented continuation); do not stitch unrelated paragraphs together. Diagnostics identify the card and the missing Must or Test requirement separately and show an accepted example. Empty/malformed optional body input must return safely, as sibling lint helpers do.

## MVP

- **Must 1:** unresolved cards mentioning `refuses` or `guard` receive a named warning when on-error Must evidence is missing, even when the trigger occurs late in the body.
- **Must 2:** independently warn when the matching unknown/error-state Test fixture and expected outcome are missing; supplying both pieces clears these new findings.
- **Must 3:** preserve the relaxation check's fail-closed/non-code caution, warning severity, resolved-card exemption, and scaffold/fence exclusions. On absent body input, return without throwing.
- Implement and integrate the check in we:scripts/check-standards-rules.mjs; extend we:scripts/__tests__/check-standards-rules-content-lint.test.mjs. No corpus rewrite or runtime change.

## Test plan

All cases belong in we:scripts/__tests__/check-standards-rules-content-lint.test.mjs and exercise the public `lintBacklogItemRendering` boundary.

- **Capability (fails on base):** title-only `refuses`, title-only `guard`, mixed case, and body-only triggers after Design/Progress each report both missing-evidence warnings.
- **Capability (fails on base):** error Must plus happy-path-only Test reports only missing Test; an unknown-state fixture plus no error Must reports only missing Must. An unknown-ref fixture expecting refusal and an error fixture expecting warning-and-continue each clear the new warnings when paired with their Must.
- **Capability (fails on base):** unrelated Design prose, fenced examples, a generic “test errors” phrase, and evidence split across unrelated paragraphs cannot satisfy a triggered card. Exercise bullet, numbered, bold-label, Must-section, Test-plan and indented-continuation forms.
- **Preservation (passes on both):** resolved cards, unrelated cards, empty body, scaffold-hint-only cards, fence-only triggers and `guardrail` do not produce the new diagnostics. Explicitly assert the new findings remain warnings, not errors.
- **Preservation (passes on both):** retain all existing relaxation cases, including missing non-code evidence despite fail-closed text. Run that existing describe block alongside the new cases; do not relax old assertions to accommodate the new check.

## Proof plan

1. Before implementation, add the capability assertions and run Vitest on we:scripts/__tests__/check-standards-rules-content-lint.test.mjs. Capture the failing test names and missing diagnostics, rather than using the standards process exit code as a warning detector.
2. After implementation, rerun that suite and demonstrate each missing-evidence fixture's exact findings and each complete fixture's absence of new findings. Remove the new check's invocation temporarily: capability tests must fail, proving they cover integration, then restore it.
3. Run `npm run check:standards` and record actual errors/warnings. The new rule is advisory like its predecessor; a zero exit alone does not demonstrate detection. Compare a triggered incomplete card with its completed Must/Test form through the public lint boundary and inspect named diagnostics. No tracked corpus fixture edits are necessary.

## Done when

1. **Musts 1-2:** the capability tests fail against the preparation base and pass with the new check; missing Must and missing Test have separate actionable warnings.
2. **Must 3:** preservation cases and existing relaxation tests pass unchanged, and `npm run check:standards` passes without introducing hard errors.
3. **Executable:** run Vitest on we:scripts/__tests__/check-standards-rules-content-lint.test.mjs (strip the documentation locus prefix when executing); capture the before/after and removed-invocation witnesses described above.

## Follow-ups

- Any promotion from advisory warning to hard error requires a separate explicit enforcement decision; no such policy change is part of this item.
- Lexical lint cannot prove a named fixture exercises its claimed behavior. Review and runtime tests remain responsible for that proof. Record observed false positives before proposing broader vocabulary or additional exemptions.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
