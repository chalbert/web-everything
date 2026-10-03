---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards.test.mjs", "we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "da67360e8f393371dab3e85697827bde1ff7b8f6"
tags: []
---

# Prevention — Reject prepared cards that supersede their own scope rationale

Filed mechanically ON APPROVAL from chalbert/web-everything#3350. The accepted review requested a check:standards failure when a prepared card acknowledges that its preserved `scopeRationale` is superseded. It mentioned allowing preparation workers to edit that field as a cheaper alternative; this story delivers the requested guard, without changing worker authorization.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3350@31e0e20e92c5ba913c4ebdb4c30b9062f3c01921

## Progress

Preparation inspected the current checkout and directly invoked the existing scope rules against the cited card. No implementation or stamping was performed.

- **Old premise / scope:** only we:backlog/2694-full-scale-interactive-rendering-state-driving-for-sighted-r.md was scoped, with a stale citation to line 17. That is the reproducer, not the implementation location.
- **Corrected premise:** the card remains prepared (line 8); its route-only rationale is at line 14, and line 39 explicitly says the preserved `scopeRationale` contains the old claim and the Progress correction supersedes it. The contradiction is real in the current text; this preparation does not independently re-investigate the product rendering claim.
- **Source evidence:** we:scripts/check-standards.mjs parses raw frontmatter and body in its section 6d-sexies loop, then skips cards without scope at line 1000. Its rationale exemptions and scope/body warnings are at lines 1041–1062. In we:scripts/check-standards-rules.mjs, `scopeEscaped` exempts nonempty rationales, and both `scopeMissingTestFile` and `bodyDeliverablesMissingFromScope` use it. A direct Node probe confirmed the prepared reproducer contains the superseding note while both existing helpers return no findings (the missing-test probe used an empty tracked-path index, so it does not establish test coverage). A search of the standards gate/rules found no detector for this contradiction; this is not already delivered.
- **Corrected scope:** implement the pure detector in we:scripts/check-standards-rules.mjs with tests in we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs; integrate the hard error in we:scripts/check-standards.mjs with coverage in we:scripts/__tests__/check-standards.test.mjs. The historical card is read-only evidence, not a required edit. Existing test files already cover pure backlog-integrity rules and gate wiring respectively.

## Design

Add a pure raw-frontmatter/body rule in we:scripts/check-standards-rules.mjs returning findings for prepared cards whose own prose explicitly disclaims their `scopeRationale`. Invoke it in the raw backlog loop of we:scripts/check-standards.mjs before the scope-absent/type/empty early exits. Use the existing `err` reporting path, including the owning card ID, rather than a warning. Do not reuse the rationale exemption: that field is the subject of this check.

Use a bounded textual contract, not semantic inference: a nonempty preparation stamp plus a nonempty string rationale, and a prose paragraph that names the exact field and explicitly describes that rationale as superseded/stale/incorrect, or says that a correction supersedes it. Support inline backticks, line wrapping and case variation. Pin the actual line-39 paragraph as the primary regression fixture. Match an assertion about the card's own preserved/frontmatter rationale, not any paragraph that happens to contain two keywords. Ignore fenced examples and blockquotes; descriptions of a proposed rule or another card's defect are not self-disclaimers. Document the accepted forms beside the matcher and tests. Do not claim general natural-language contradiction detection.

Apply this check to every prepared card kind and status: the requirement is about a prepared assertion, so a resolved status must not silently exempt it. A missing/empty stamp, missing/empty rationale, or an unrelated correction yields no finding. Existing malformed-frontmatter diagnostics remain authoritative; do not swallow them or add a new parse fallback.

The diagnostic must explain that a body correction cannot validate contradictory frontmatter and require reconciliation by an authorized editor before the card passes. Do not advise deleting evidence, shrinking the write set, or bypassing the gate. This story does not grant a constrained preparation worker permission to edit other frontmatter.

## MVP

Deliver the pure detector and fixtures in we:scripts/check-standards-rules.mjs and we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs, plus hard-error integration and gate coverage in we:scripts/check-standards.mjs and we:scripts/__tests__/check-standards.test.mjs. One focused guard, no new command, schema, dependency or worker policy.

Must fail through check:standards when a prepared card explicitly supersedes its own preserved rationale, including when scope is absent or malformed; other scope errors may coexist.

Must apply equally to cards scoped to source, documentation, skills, configuration or data. No extension-based exemption or broader relaxation of existing scope checks.

## Done when

1. The exact reproducer paragraph, paired with prepared frontmatter and the old rationale, produces a hard error naming its card and `scopeRationale`.
2. A reconciled synthetic card passes the new rule; ordinary discussion, quotations and unprepared cards do not produce false positives.
3. Gate integration runs before scope early returns and does not downgrade the finding to a warning or suppress it because a rationale exists.
4. Focused tests pass and a real gate run demonstrates the diagnostic and failing exit status. Any existing corpus failures are identified separately; no unrelated card edits are hidden in this implementation.

## Test plan

In we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs, cover the exact reproducer; wrapped/backticked and capitalization variants; direct stale/incorrect/superseded self-disclaimers; prepared resolved and open cards; absent/empty stamps and rationales; unrelated supersession; separate paragraphs containing isolated keywords; rule descriptions; third-party references; fenced examples and blockquotes. Include missing and malformed scope, and representative source/docs/config/data scopes to prove the check does not depend on scope shape or file kind.

In we:scripts/__tests__/check-standards.test.mjs, verify the real gate imports/calls the rule and reports through `err` before scope early exits, following its existing wiring-test conventions. Supplement that structural check with the executable gate proof below; source inspection alone is not runtime proof.

Run focused Vitest tests for both declared test files, then the runner-owned check:standards gate. The new exact-reproducer assertion must fail against the pre-change rules and pass after implementation. No runtime API or rendered page changes are involved.

## Proof plan

At implementation time, record the checkout SHA, focused test output and check:standards exit status. If the historical card still contains the contradiction, run the actual gate against it and capture the owning-card diagnostic. Otherwise use an isolated temporary checkout with a minimal valid synthetic card carrying the verbatim note and prepared rationale; do not mutate the acquired lane's historical card for proof.

In that isolated fixture, show the new diagnostic appears with nonzero exit status, then reconcile the rationale and remove the now-obsolete self-disclaimer and show that diagnostic disappears. Compare unrelated baseline errors separately; claim a fully green gate only when observed. Also run with scope omitted to prove the call is reachable before early returns. The fixture should retain valid parent/kind/size metadata so unrelated validation does not masquerade as this rule's result.

## Follow-ups

- An authorized owner may need to reconcile the historical card before a corpus-wide gate can be green. Do not delete its contradiction note solely to silence the new rule; verify and correct the rationale, then update the obsolete note together. That repair is outside this story's implementation scope.
- Changing the preparation brief to allow `scopeRationale` edits remains a separate authorization-policy proposal, not a prerequisite or a choice silently made here.
- Broader semantic contradiction detection is outside this bounded guard. Add new textual forms only with concrete examples and false-positive fixtures.
