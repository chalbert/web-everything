---
bornAs: xjcwinh
kind: story
size: 5
parent: "3318"
status: open
scope: ["we:scripts/lib/jury-core.mjs", "we:scripts/lib/review-core.mjs", "we:scripts/lib/jury-ledger.mjs", "we:scripts/lib/__tests__/jury-core.test.mjs", "we:scripts/lib/__tests__/review-core.test.mjs", "we:skills-src/review/SKILL.md"]
dateOpened: "2026-09-21"
tags: []
---

# Add the 'unverifiable as submitted' disposition to the jury: a gated fourth DISPOSITIONS member that earns a round, counted apart from blockers

Build the ruling ratified in #3375 (rule: we:docs/agent/platform-decisions.md#creator-owed-proof-not-reviewer-rederivation). A reviewer may answer 'unverifiable as submitted' when a load-bearing claim about the creator's own code carries nothing cheaply checkable. It is a fourth DISPOSITIONS member in we:scripts/lib/jury-core.mjs, produced by a precondition question asked before the existing three-question routing, gated on a conjunctive test (impactIfUnfixed at or above a new UNVERIFIABLE_IMPACT_BAR, cost-asymmetric, and a stated verificationAttempt). It earns a round like a blocker but is counted separately so #3318's metrics tell 'reviewer found a bug' from 'creator skipped proof'.

## Design (all forks settled by #3375 — nothing here is open)

- **Fourth member, gated in front.** `DISPOSITIONS.UNVERIFIABLE` joins `blocker`/`carve-out`/`nit`.
  `deriveFindingDisposition({ verifiableAsSubmitted, verificationAttempt, introduced, worseThanBase, parallelizable })`
  checks `verifiableAsSubmitted` **first**: `false` with a non-empty `verificationAttempt` routes straight to
  `UNVERIFIABLE` and the three existing questions are never asked. `true` or omitted falls through to today's
  routing, byte-stable. `buildSubjectMandate`'s DISPOSITION block asks the precondition question before the three.
- **Conjunctive gate (Fork 1).** All three must hold: (1) `impactIfUnfixed` at or above a new
  `UNVERIFIABLE_IMPACT_BAR`, defaulting to `broken` but a **distinct constant** from `PREVENTION_IMPACT_BAR`;
  (2) cost-asymmetric — a judgment boolean, not a numeric threshold; (3) a non-empty `verificationAttempt`,
  shape-checked only for presence. An `unverifiable` answer missing the attempt is incomplete, so it reads as
  undecided and fails closed as an ordinary blocking finding. The honesty of the attempt is deliberately not
  machine-checked (named friction-not-enforcement gap in #3375).
- **Earns a round, counted separately.** `DISPOSITION_EARNS_ROUND[UNVERIFIABLE] = true`, never folded into the
  `blocker` count, so #3318's per-category metrics can tell a reviewer-found bug from a creator-skipped proof.
  `deriveVerdict`, `derivePanelVerdict`, `VERDICT_STRICTNESS` and `deriveNegotiationOutcome` need **no edit**
  (they switch on the four-member `VERDICTS` string and never read `disposition`); no new `VERDICTS` member.
  The render layer surfaces the distinction in prose by reading the findings list.
- **Harvest routing, no new mechanism.** The per-finding signal reaches the jury ledger's `FINDING` event for
  free. The review skill tells a session that dispositions a finding `unverifiable` to also drop one
  `we:scripts/conveyor/learnings-drop.mjs` entry (`kind: 'missing-convention'`, `area` like
  `"creator-proof / dispatch-brief"`). No new `kind`, no new schema field.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/jury-core.test.mjs` passes with new cases that fail
   before this item: the disposition truth table gains exactly one dispositive branch (`verifiableAsSubmitted:
   false` + non-empty `verificationAttempt` → `UNVERIFIABLE`) and the existing eight combinations are unchanged;
   `false` with an empty or missing `verificationAttempt` is undecided and blocks; `earnsRound(UNVERIFIABLE)` is
   `true`; an `unverifiable` finding below `UNVERIFIABLE_IMPACT_BAR` does not stand as a refusal.
2. **Executable** — a test drives the real `deriveVerdict` and `deriveNegotiationOutcome` with one outstanding
   `unverifiable` finding and asserts the result is `changes` / continue, with those two functions unedited.
3. **Executable** — a test asserts the per-disposition tally reports `unverifiable` as its own count, distinct
   from `blocker`, in the shape `we:scripts/lib/jury-ledger.mjs` records.
4. **Observable** — `we:skills-src/review/SKILL.md` carries the instruction to drop one `missing-convention`
   learnings entry when dispositioning a finding `unverifiable`; `npm run check:standards` reports 0 errors.
