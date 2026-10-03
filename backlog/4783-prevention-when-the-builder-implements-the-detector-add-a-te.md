---
bornAs: xc1zo4f
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4709-prevention-add-a-check-standards-or-prepare-stamp-gate-any-c.md", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "8b3cb25274eca9818bfec5c6fe898c85368b4fe2"
tags: []
---

# Prevention — When the builder implements the detector, add a test that runs findDoneWhenGaps over this card's own bo… (from chalbert/web-everything#3644 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. Review guard from the Done-when acceptance example in `we:backlog/4709-prevention-add-a-check-standards-or-prepare-stamp-gate-any-c.md`: run the detector over that reviewed card's own body and expect `[]`; anchor placeholder detection to the scaffold line shape rather than a bare substring.
2. Review guard from that card's MVP and Test plan: a stamped decision or epic without Done-when must produce no Done-when warning; state one consistent detector signature.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3644@09aef17ff25924ac7adc66969c1f8e3baf4eb444

## Progress

- Premise checked on 2026-10-03 at checkout HEAD `8b3cb2527`. The original scope named only the reviewed card, and the original line references 109 and 55 were review-snapshot locations. Current evidence is the reviewed card's Design, MVP Must 3, and Done when sections; the references above now name those sections instead of unstable lines.
- The detector is not delivered: searching `we:scripts/` for `findDoneWhenGaps` returns no matches. History for the two item keys records filing and preparation, including preparation commit `a451d570c`, not detector delivery. `we:scripts/check-standards-rules.mjs` currently exports `findMustWithoutDoneWhen` and `lintBacklogItemRendering`; neither implements the proposed missing/placeholder-section check.
- Corrected scope includes the eventual detector/lint implementation and its existing matching suite, `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`, as well as the reviewed specification card. That suite already imports the lint and reads repository fixtures with `readFileSync`; no new test runner is needed. `we:scripts/backlog/scaffold.mjs:113` emits the actual placeholder line and is read-only evidence.
- The reviewed card's Design proposes a body-only detector, while MVP Must 3 says the detector reads metadata from `item`. Its Design also describes a bare `TODO:` match, although its real acceptance clauses discuss that token. These are specification inconsistencies to correct, not new policy forks: the review explicitly requires the narrow placeholder match and decision/epic exemption.
- Implementation prerequisite: 4709 supplies the detector and stamp gate. This item specifies the review hardening to accompany or follow that implementation; it does not duplicate the stamp/conveyor work. Before building, confirm that prerequisite is available. No detector test can pass on this checkout yet.

## Design

Use one pure interface, `findDoneWhenGaps(body)`, returning the gap array described by the prerequisite. The detector inspects only the Done-when section. Metadata belongs to the caller: `lintBacklogItemRendering` invokes it only for a story or task with a non-empty `preparedAgainstSha` whose status is not resolved. Decisions and epics bypass this warning regardless of their body. Keep the prerequisite's first-stamp versus re-stamp behavior unchanged.

Match a numbered Done-when clause whose text begins with the emitted scaffold prefix: number, period and whitespace, bold Executable label, em dash, then `TODO:`. Anchor at the start of the clause line; tolerate horizontal spacing and CRLF. A mention of `TODO:` later in a real acceptance clause, or in Design/Test plan prose, is not a placeholder. The exact current scaffold remains a positive fixture. Use the existing section extraction convention in `we:scripts/check-standards-rules.mjs`.

Amend the reviewed card's Design, MVP and Test plan to agree with this interface and caller filtering. “This card's own body” in the original review means the reviewed 4709 card, not this mechanically filed follow-up. Read its actual body with frontmatter stripped in the existing content-lint suite and assert an empty detector result; do not sanitize its mentions of the placeholder token or replace it with a simplified synthetic fixture.

## MVP

**Must**
1. Align the reviewed specification in `we:backlog/4709-prevention-add-a-check-standards-or-prepare-stamp-gate-any-c.md` around the body-only signature, scaffold-shaped match, and story/task-only lint eligibility.
2. In `we:scripts/check-standards-rules.mjs`, harden the prerequisite detector's placeholder match and its lint caller's kind guard to implement that contract.
3. Add executable regression coverage in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`, including the actual reviewed card body and stamped decision/epic cases. This suite is the matching test scope for the source entry and also checks the reviewed card as a fixture.

## Test plan

- **Capability, RED today:** the detector export is absent. Once the prerequisite is available, read the reviewed card body from disk, strip frontmatter, and assert `[]`. A mutation to a bare `TODO:` substring search must fail this case because its real Done-when clauses discuss the token.
- **Capability, RED today:** the exact scaffold clause yields `placeholder-clause`; repeat with CRLF and spacing variants. A real numbered clause mentioning `TODO:` later in its text yields `[]`. Mutating the detector to always return `[]` must fail the scaffold case.
- **Capability, RED today:** missing Done-when yields `missing-section`; a section with only prose yields `no-numbered-clause`. These positive controls prevent an accidentally disabled detector from satisfying all negative cases.
- **Preservation:** table-test stamped, open decision and epic records with no Done-when through the lint; assert absence of the Done-when warning specifically, not absence of unrelated warnings. These cases pass today; mutation proof is removal of the new kind guard after the prerequisite lands.
- **Capability, RED today:** stamped open story and task records with no Done-when produce the new warning. **Preservation:** unprepared and resolved counterparts produce no such warning; removing the stamp or status guard must fail the corresponding case.

All cases live in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`; fixture reads use repository-root resolution already present there. No stamp CLI or conveyor behavior changes are included here.

## Proof plan

Run the focused content-lint suite with Vitest after the prerequisite is present, recording the prerequisite commit. First run the added tests against a bare-substring matcher and against a lint caller without the kind filter: capture the reviewed-body false positive and the decision/epic warnings. Restore the intended implementation and rerun; require all cases green. Also confirm the scaffold and bad story/task controls fail if detection is disabled.

Run `npm run check:standards` and the scoped backlog lint for both cards. Record warnings separately from errors: a green warning-level gate alone does not prove the exemptions or matching behavior. The focused assertions supply that proof. Preparation does not claim these future implementation tests have passed.

## Follow-ups

The prerequisite owns stamp refusal, stamp idempotence, and conveyor handling. Its citation-staleness and external-text sanitization follow-ups remain separate. Broader Markdown parsing or additional placeholder vocabularies are outside this review guard; no new policy or follow-up card is required to implement it.

## Done when

1. **Executable** — The focused Vitest run for `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` passes with the actual reviewed-body fixture, scaffold controls, and stamped kind matrix; the specified matcher and kind-guard mutations fail it (Musts 2, 3).
2. **Executable** — Scoped backlog lint passes for both cards and `npm run check:standards` has no new errors; the reviewed card consistently specifies the body-only detector and caller-owned metadata filtering (Must 1).
