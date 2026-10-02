---
bornAs: xkn31un
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-backlog-item.mjs", "we:scripts/__tests__/check-backlog-item.test.mjs", "we:docs/agent/backlog-workflow.md"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "2252451f641990568d13fe0ed9bd9f1e179afd48"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3107's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4599-define-human-forge-edits-and-durable-acknowledgements-at-the.md:4` — Make check-backlog-item or check-standards reject any diff that flips a kind:decision to status: resolved without codifiedIn, so it applies to hand edits as well as the verb. Today only the verb and the legacy G6 audit cover this.
2. `we:backlog/4599-define-human-forge-edits-and-durable-acknowledgements-at-the.md:36` — Add a resolve-time prompt or checklist that walks the Done-when clauses, or requires spun-off follow-up ids for anything left unaddressed. Failing that, add a review lens for decision resolutions that compares the ruling with the Done-when.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3107@6c66a5ba5bc68b028cb1db8083f1a1cf3f75ea7e

## Progress

Preparation research (2026-10-02): the prevention is not already delivered.

- **Old premise/scope:** the scope named only the reviewed decision, and the review cited lines 4 and 36 of we:backlog/4599-define-human-forge-edits-and-durable-acknowledgements-at-the.md. Those are incident context (resolved frontmatter and Done-when), not guard implementation locations.
- **Corrected premise/scope:** implement the first guard in the explicitly permitted per-item checker, we:scripts/check-backlog-item.mjs, with its existing subprocess tests in we:scripts/__tests__/check-backlog-item.test.mjs. Implement the second guard as a resolve-time checklist in we:docs/agent/backlog-workflow.md, beside “Mark it resolved — through the declared operation.” No edit to the incident decision is required; its unfinished substantive ruling must not be invented by this prevention story.
- **Source evidence:** we:scripts/backlog/frontmatter.mjs exports `validateCodifiedIn` and checks decision resolution in `applyTransition`; we:scripts/operations/resolve.mjs delegates that transition and names the refusal `uncodified-decision`. In contrast, we:scripts/check-backlog-item.mjs checks rendering, YAML, blocker references, queue fields and locus prefixes without a codification guard. A real `npm run check:item -- 4599` equivalent invocation of that checker exited 0 and reported clean despite the incident card's resolved decision having no `codifiedIn`. The G6 scan in we:scripts/audit-backlog-health.mjs remains an audit, not this per-item refusal.
- **Second guard evidence:** we:docs/agent/backlog-workflow.md already requires codification and existing ids for claimed deferrals, but its resolve step does not explicitly walk every decision Done-when clause against the ruling. Add that missing checklist without changing the decision authority or claiming prose can be semantically validated by a field-presence check.
- **Overlap:** #4683 independently requests a changed-card whole-repository codification gate. This story uses the per-item alternative already authorized in the original request; coordinate shared validation when #4683 is implemented rather than duplicating its broader integration.

## Design

Add an error-level check to we:scripts/check-backlog-item.mjs for the explicitly selected card whose raw frontmatter has `kind: decision` and `status: resolved` but lacks a nonblank `codifiedIn`. Read parsed frontmatter rather than depending on the loader exposing that field. Reuse the existing YAML failure reporting: malformed YAML must fail without a second uncaught parse exception. The error names the item and explains promotion to the statute layer or the existing `one-off` sentinel for a genuinely one-off ruling.

This is a presence guard for hand edits, not a new pointer grammar. Missing, null, empty strings and whitespace-only strings fail. A nonblank scalar supplies presence. Reuse `validateCodifiedIn` for scalar validation rather than inventing a competing pointer grammar; guard non-string values before calling it so malformed types report an error instead of throwing. Adding array support is separate work tracked by #2846, not a compatibility assumption here. Target resolution remains with its existing checks. Open/active decisions and non-decisions are unaffected. Checking one explicitly selected legacy decision may expose its debt; this change does not turn the entire legacy G6 pool into a global gate.

Add a decision-specific checklist immediately before the resolution instruction in we:docs/agent/backlog-workflow.md: enumerate each Done-when clause, point to the ruling or evidence that satisfies it, and name an already-filed follow-up id plus the remaining obligation for any deferred part. Confirm codification separately. An uncovered clause must be completed or explicitly accounted for before resolution; a follow-up reference records a deferral and does not itself prove the original clause was delivered. Apply the checklist to hand-authored resolution diffs as well as the declared operation.

## MVP

1. **Must 1 — hand-edit refusal:** we:scripts/check-backlog-item.mjs exits nonzero with an actionable codification diagnostic for a selected resolved decision missing codification presence.
2. **Must 2 — bounded compatibility:** preserve positive results for present codification, unresolved decisions and non-decisions, and preserve malformed-YAML diagnostics. Pin these behaviors through actual checker subprocesses in we:scripts/__tests__/check-backlog-item.test.mjs.
3. **Must 3 — completeness checklist:** we:docs/agent/backlog-workflow.md requires a clause-by-clause Done-when accounting, existing follow-up ids for deferred obligations, and a codification check before decision resolution.

## Test plan

Extend we:scripts/__tests__/check-backlog-item.test.mjs using its existing fixture cleanup pattern. Exercise the real checker and assert both exit status and the codification diagnostic; do not settle for source-text assertions.

- Negative rows: resolved decisions with omitted, null, empty or whitespace-only codification; malformed non-string values must produce a diagnostic without throwing.
- Positive controls: `one-off` and a valid guideline pointer; open and active decisions without codification; a resolved task without codification. Use otherwise valid frontmatter so another error cannot satisfy the assertion accidentally.
- Malformed YAML stays a reported validation failure rather than a thrown stack trace. Fixtures must be removed even on assertion failure.
- Source/test pairing: we:scripts/check-backlog-item.mjs → we:scripts/__tests__/check-backlog-item.test.mjs. The workflow document is checked by a manual checklist walkthrough, not a runtime unit test.

## Proof plan

Before implementing, add the missing-codification regression case and run the focused Vitest test: it must fail because the current checker exits 0. After implementation, run the same case and the full we:scripts/__tests__/check-backlog-item.test.mjs suite; assert exit 1 for the invalid fixture and exit 0 for its valid controls. Capture the diagnostic and test result as evidence, using disposable fixtures rather than resolving a real decision.

Walk the checklist against the incident decision's Done-when: distinguish its recorded human-label ruling from the command acknowledgement boundary, conformance vectors and codification obligations; identify which have evidence and which need explicit accounting. Do not supply a missing human ruling during this exercise. Finally run `npm run check:standards` and the per-item lint for this card under the normal runner checks. A clean per-item result does not assert whole-repository CI coverage of every resolution diff.

## Done when

1. **Musts 1, 2:** the new missing-codification subprocess regression fails against the pre-change checker and passes after it; all compatibility controls in we:scripts/__tests__/check-backlog-item.test.mjs pass.
2. **Must 3:** the workflow checklist explicitly covers every Done-when clause, evidence/ruling links, already-filed follow-up ids for deferrals, and codification; the incident walkthrough demonstrates that uncovered obligations are visible before resolution.
3. `npm run check:standards` passes with the implementation and the focused tests provide actual exit-code evidence.

## Follow-ups

- #4683 owns the overlapping whole-repository changed-card guard; reuse the resulting presence semantics and avoid a second conflicting rule when that integration lands.
- Repairing the substance or codification of #4599 is outside this prevention implementation. Any missing ruling remains with its decision authority; this card does not assert a repair was filed or delivered.
- Automatic semantic evaluation of Done-when prose, a new resolve argument/schema, and migration of the legacy G6 pool are outside this MVP. The authorized resolve-time checklist supplies the second prevention guard without those policy changes.
