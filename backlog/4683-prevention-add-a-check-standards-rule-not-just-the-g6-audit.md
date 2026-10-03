---
bornAs: xf3tgxh
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards-backlog-submissions.test.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs", "we:scripts/audit-backlog-health.mjs", "we:scripts/__tests__/audit-backlog-health.test.mjs", "we:scripts/__tests__/check-standards.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "a770bdad0ced4c8304349bd4476eeea4befd0f97"
tags: []
---

# Prevention — reject uncodified decision resolutions and unfinished backlog submissions

Filed mechanically on approval of chalbert/web-everything#3229. Preserve the three prevention goals: catch direct-edit decision resolutions without codification in `check:standards`; make the literal unfinished acceptance placeholder a hard A1 failure; reject unmodified submission boilerplate in new stories.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3229@8fc41e30e1645e2e012804afba147899419b6c15

## Progress

Premise checked against the acquired checkout on 2026-10-02. The original scope contained only the three example cards, and its citations pointed to their symptoms rather than implementation. Corrected scope is the standards entry point, pure rule module, health audit, and matching tests; the new CLI integration test is planned. The examples remain evidence, not files this implementation must rewrite:

- `we:backlog/4673-model-routing-strategy.md` still has `kind: decision`, `status: resolved`, and no `codifiedIn`. Its frontmatter, rather than the old line-4 citation alone, demonstrates the bypass.
- `we:backlog/4681-routing-pilot-stage-0-join-every-model-call-to-its-card-step.md` and `we:backlog/4679-routing-pilot-one-capped-hosted-open-weight-trial.md` still contain unfinished acceptance text and the scaffold hint under `## Done when`. Heading references replace the original line-14/line-19 citations.
- `we:scripts/backlog/frontmatter.mjs` already enforces codification through `validateCodifiedIn` during resolution. The missing protection is direct file editing, not the resolve operation. Authority: `we:docs/agent/platform-decisions.md#promotion-discipline-enforced`.
- `we:scripts/audit-backlog-health.mjs` collects G6 and A1 as candidate flags; its CLI does not set a failing exit status for A1. A direct import probe of `missingDoneWhenProof` on the scaffold acceptance sentence returned `hit: true, reason: no-executable-token`. Detection alone therefore does not deliver the requested refusal.
- `we:scripts/backlog/scaffold.mjs` exports `GUARD_RELAXATION_HINT` and emits the acceptance placeholder. `we:scripts/check-standards-rules.mjs` currently strips that hint for guard-relaxation analysis rather than rejecting it. No submission-placeholder or uncodified-resolution rule was found there.
- `we:scripts/check-standards.mjs` distinguishes explicit local file lists from their linked-file expansion and defaults to whole-repository checking. Its provenance pass already resolves a merge base against origin/main. A new change-sensitive rule must not accidentally treat every historical or linked card as newly submitted.

## Design

Add pure submission validation in `we:scripts/check-standards-rules.mjs`, with explicit inputs for the current card, body, and change classification (added versus modified). Return file-attributable errors using the existing standards diagnostic shape.

For added or modified cards, reject `kind: decision` plus `status: resolved` when `codifiedIn` is absent, null, empty, or whitespace-only. Accept the existing `one-off` sentinel; retain existing pointer validation rather than defining a different codification syntax. Read the actual frontmatter value if the loaded record does not expose it.

For added stories, reject the exact scaffold acceptance sentence and the exact `GUARD_RELAXATION_HINT` as standalone unmodified lines outside fenced examples. Reuse the exported hint. Do not ban arbitrary TODO prose or quoted discussions of the defect. For open executable cards, detect the literal unfinished acceptance phrase inside `## Done when` or legacy `## Acceptance` before the usual token/exemption checks. Give it a distinct A1 reason and fail the health CLI when that reason is present in its selected audit scope; other A1 reasons and G6 remain candidate findings. The standards submission rule must also reject that acceptance defect on changed open executable cards, so the normal submission gate catches it.

Wire the standards rule in `we:scripts/check-standards.mjs`. Derive added/modified candidates from the merge-base-to-working-tree diff against origin/main, including staged changes and untracked backlog cards. Exclude deletions. Use explicit local file lists to restrict candidates when provided, without promoting linked unchanged cards to changed submissions. A missing comparison base or failed candidate enumeration must produce an attributable gate error rather than silently skip this prevention. Existing whole-repository validators retain their behavior; only these new submission checks are change-sensitive.

## MVP

1. Add the pure codification and exact boilerplate checks with unit fixtures in `we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs`.
2. Wire candidate selection and diagnostics into `we:scripts/check-standards.mjs`; add the planned `we:scripts/__tests__/check-standards-backlog-submissions.test.mjs` using disposable Git repositories and a callable candidate-selection seam or subprocess harness.
3. Update `we:scripts/audit-backlog-health.mjs` so the exact acceptance-placeholder reason cannot be masked by a command token or exemption and causes a nonzero CLI exit after normal reporting. Cover it in `we:scripts/__tests__/audit-backlog-health.test.mjs`.
4. Leave scaffold generation usable for drafting. Its output must be completed before submission; this work does not silently invent acceptance criteria for existing cards.

## Test plan

- Codification matrix: added and modified resolved decisions with missing/null/blank codification fail; a populated pointer or `one-off` passes this presence check; unresolved decisions and resolved stories do not trigger it.
- Placeholder matrix: exact acceptance placeholder fails even beside a valid command or exemption; the unchanged standalone hint fails for added stories; completed acceptance passes. Fenced examples and historical discussion outside acceptance remain valid. Preserve the existing executable-kind classification.
- Candidate selection: committed branch changes, staged and unstaged modifications, untracked additions, deleted files, unchanged legacy defects, linked unchanged cards, explicit local file lists, and missing base/ref failures. Verify additions remain classified as additions after staging.
- CLI behavior: seeded defects produce nonzero status and identify the card and rule; correcting only the defect clears that diagnostic. Health emits its report and JSON normally while failing for the specific placeholder reason. Other candidate-only audit flags retain existing exit behavior.
- Source/test pairs are listed together in scope. The CLI integration test is new; the rule and audit test files already exist.

## Done when

1. The regression cases in `we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs`, `we:scripts/__tests__/check-standards-backlog-submissions.test.mjs`, and `we:scripts/__tests__/audit-backlog-health.test.mjs` fail before implementation and pass afterward.
2. `npm run check:standards` rejects a changed resolved decision lacking codification and a new story retaining scaffold boilerplate, with a diagnostic naming the offending card.
3. The health audit exits nonzero for an open executable card with the literal acceptance placeholder, including when another criterion looks executable; fixing the placeholder clears that specific failure.

## Proof plan

Run the three scoped Vitest suites named above. In an isolated fixture checkout with a known origin/main baseline, demonstrate the actual standards CLI red/green pair for each defect, preserving stdout, stderr and exit code. Include an unchanged legacy defective card to prove the change-sensitive boundary. Run the health CLI against an isolated fixture corpus with its output directed inside that fixture, record the placeholder failure, replace it with concrete proof, and record the cleared result. Never mutate production audit reports for the demonstration. Finish with `npm run check:standards`; distinguish unrelated baseline findings from these regression results. Preparation itself does not claim that these future guards pass.

## Follow-ups

Existing G6 and A1 debt remains visible for separate card-specific remediation. Do not bulk-add `one-off`, manufacture acceptance commands, broaden the placeholder lexicon, or change queue eligibility in this item. Broader quality judgments require separately specified rules; this MVP enforces the concrete defects named by the approval.
