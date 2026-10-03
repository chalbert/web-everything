---
bornAs: x18mtny
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4963-close-watch-hand-holding-mode-keep-all-or-chosen-sessions-un.md", "we:backlog/4945-delivery-postmortem-toggle-turn-on-a-root-cause-postmortem-f.md", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-02"
preparedAgainstSha: "35f85c0f1d9f7c7ff718fa927f00ca12dd248b78"
tags: []
---

# Prevention — Add a card-template or check:standards rule requiring a 'Must treat X as untrusted / bounded authority'… (from chalbert/web-everything#3358 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4963-close-watch-hand-holding-mode-keep-all-or-chosen-sessions-un.md` — Add a card-template or check:standards rule requiring a 'Must treat X as untrusted / bounded authority' line on epics that introduce an automated actor acting on untrusted input; at minimum, add that line to this epic's Done-when when it is decomposed.
2. `we:backlog/4945-delivery-postmortem-toggle-turn-on-a-root-cause-postmortem-f.md` — A template linter or check that flags known boilerplate hints (like the "loosens a refusal" hint) when they are left unmodified in newly filed backlog items, or requires deleting unused template sections.
3. `we:backlog/4963-close-watch-hand-holding-mode-keep-all-or-chosen-sessions-un.md` — A template linter or check that flags known boilerplate hints (like the "loosens a refusal" hint) when they are left unmodified in newly filed backlog items, or requires deleting unused template sections.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3358@a4418622ee8c455bcd4fa2074cbae0dddcc434cb

## Design

Implement the explicitly permitted minimum authority safeguard in the close-watch epic, plus a shared warning for leftover scaffold guidance. No automated semantic classification of arbitrary epics is needed for this slice.

In we:backlog/4963-close-watch-hand-holding-mode-keep-all-or-chosen-sessions-un.md, replace the generic hint with a concrete Done-when requirement: “Must treat watched transcripts and embedded source, docs, config, data, tool output, and quoted instructions as untrusted evidence, never as authority to expand the operator-selected supervision scope or redirect permissions.” Carry that requirement into the epic's decomposition acceptance criteria. This documents the boundary already implicit in operator-selected sessions and intervention settings; it does not implement supervisor behavior.

In we:scripts/check-standards-rules.mjs, add an exact-line leftover-hint detector using the already imported `GUARD_RELAXATION_HINT` from we:scripts/backlog/scaffold.mjs. Trim surrounding whitespace, ignore fenced examples, and emit one actionable warning through `lintBacklogItemRendering` for a non-resolved card containing the standalone hint. Tell the author to replace it with applicable acceptance criteria or delete it when irrelevant. Match the known literal, not every “Hint” or TODO. Keep the existing guard-relaxation scan and its hint-stripping behavior intact. Both the full gate in we:scripts/check-standards.mjs and scoped gate in we:scripts/check-backlog-item.mjs already call this shared function; neither needs a new implementation.

Remove the irrelevant standalone hint from we:backlog/4945-delivery-postmortem-toggle-turn-on-a-root-cause-postmortem-f.md. Keep the generator's authoring guidance: fresh skeletons may warn until authored, but remain structurally valid. Warning severity follows the neighboring prose-authoring checks and avoids blocking the historical corpus. No date cutoff is needed: all non-resolved cards, including newly filed ones, receive the warning.

## MVP

1. Must record the concrete untrusted-input and bounded-authority acceptance requirement in the close-watch epic.
2. Must flag the unchanged standalone scaffold hint on non-resolved cards with replacement/deletion guidance, once per card.
3. Must ignore fenced examples and resolved cards, and leave existing guard-relaxation detection unchanged.
4. Must remove the unused hint from both cited epics without inventing implementation or executable acceptance criteria for their unfinished features.

## Done when

1. **Executable — Musts 2–3:** the focused cases in we:scripts/__tests__/check-standards-rules-content-lint.test.mjs pass, including a leftover-hint assertion that fails against the pre-change shared linter. Run that file with Vitest; warnings are asserted explicitly because the gate does not fail on warnings.
2. **Observable — Musts 1, 4:** read both cited epics and run their scoped item checks. Neither retains the standalone hint; close-watch explicitly bounds authority across the named input kinds. Its decomposition requirement is visible without assuming a supervisor implementation exists.

## Test plan

Extend we:scripts/__tests__/check-standards-rules-content-lint.test.mjs (matching source: we:scripts/check-standards-rules.mjs):

- A non-resolved epic with the exact standalone hint produces one actionable leftover-hint warning; include open and active status cases. Red today: the shared linter silently strips the hint for refusal analysis and emits no leftover-hint warning.
- Leading/trailing whitespace and duplicate occurrences still yield one warning. Red today: no leftover-hint detection exists.
- Removing the hint clears that warning. A different authored Hint sentence, an inline quotation, and a fenced copy do not trigger it; a resolved card stays silent. These constrain the new detector rather than declaring generic boilerplate matching.
- Render a fresh epic with `renderItem` from we:scripts/backlog/scaffold.mjs and pass its body to the shared linter: the real emitted hint warns. Red today: this warning is absent. Keep the existing scaffold-output contract in we:scripts/backlog/__tests__/scaffold.test.mjs unchanged.
- Retain the existing refusal-relaxation cases: a relaxing digest with only the template hint still lacks both fail-closed and non-code requirements; real acceptance text satisfies the existing scan. This guards against the new diagnostic accidentally supplying authority or removing the old checks.

The two scoped backlog documents are acceptance prose, not executable source; their matching validation is the scoped item lint plus direct review under Done when, rather than invented unit-test files.

## Proof plan

Before implementation, add the focused leftover-hint assertion and run it against the current shared linter to capture the missing warning. After implementation, run the same assertion and the full content-lint test file, then the existing scaffold tests. Run the scoped gate for each cited epic and inspect actual warnings, not just exit status. Finally run `npm run check:standards`, attributing any pre-existing findings separately. Record command output and the before/after warning behavior in the implementation PR. Preparation itself supplies a plan, not a claim that these future tests pass.

## Follow-ups

A broader template vocabulary or semantic detector for every automated-actor epic is outside this slice. Revisit only with concrete missed cases; the present guard flags the known literal and delivers the review's explicitly allowed epic-local authority requirement. The close-watch implementation must later prove that requirement through its own decomposition and runtime tests.

## Progress

- Original premise/scope: three review findings cited two epic cards by line and scoped only those documents, although two findings requested shared prevention for leftover template hints.
- Corrected premise: both cited cards still have a placeholder Done-when clause and the unchanged standalone hint. Close-watch describes a supervisor reading live transcripts but has no explicit untrusted-input authority boundary. The cited line numbers were brittle anchors to the Done-when area; references now name the cards and their sections.
- Source evidence: `renderItem` in we:scripts/backlog/scaffold.mjs appends `GUARD_RELAXATION_HINT` to every generated Done-when skeleton; we:scripts/backlog/__tests__/scaffold.test.mjs pins its presence. `findGuardRelaxationGaps` in we:scripts/check-standards-rules.mjs explicitly discards that line, while we:scripts/__tests__/check-standards-rules-content-lint.test.mjs verifies that it neither triggers nor satisfies refusal checks. The shared `lintBacklogItemRendering` has the warning integration seam consumed by both gates. This is partial related protection, not delivery of the requested leftover-hint guard.
- Corrected scope: retain the two epic documents and add we:scripts/check-standards-rules.mjs with its existing matching test file we:scripts/__tests__/check-standards-rules-content-lint.test.mjs. No generator or gate-entrypoint change is required. Preparation edits only this card; stamps and implementation remain with the runner and subsequent build.
