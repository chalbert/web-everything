---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xkoqlar-a-block-ruling-on-a-mandatory-referral-sends-the-pr-back-for.md"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "7abf0a58f0e62f1f439de96bd5139f6cc689ad3e"
tags: []
---

# Prevention — Add a Must line to this card: ruling rationale and evidence are rendered through the existing finding-b… (from chalbert/web-everything#3535 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xkoqlar-a-block-ruling-on-a-mandatory-referral-sends-the-pr-back-for.md:27` — Add a Must line to this card: ruling rationale and evidence are rendered through the existing finding-body sanitizer, with a regression test injecting a marker and directive. Longer term, add a lint or standards-gate rule that any reviewer-authored string interpolated into a published comment goes through a shared escape helper.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3535@b02a8a26356b8ba88dae5e1c1935e65830704abc

## Progress

Old premise/scope: add a Must line at the historical line 27 of `we:backlog/xkoqlar-a-block-ruling-on-a-mandatory-referral-sends-the-pr-back-for.md`, describing an existing finding-body sanitizer, with a longer-term lint suggestion. The target card is still open and its Design and Test plan lack that explicit requirement; this documentation goal is not already delivered.

Corrected premise/scope: retain the documentation-only scope, and anchor the addition to the target card's Design and Test plan rather than the stale line number. `renderVerdictWriteUp` in `we:scripts/operations/review-pr.mjs:1508` delegates findings to `renderPanelComment`; `renderFindingLine` in `we:scripts/lib/review-render.mjs` interpolates finding prose without a sanitizer. The existing protection is the final prose boundary in `buildVerdictComment` at `we:scripts/review-set-label.mjs:1717`, using `neutralizeCommentMarkers` at `we:scripts/review-set-label.mjs:1793`. It escapes HTML-comment delimiters, not arbitrary instructions. The existing adversarial controls are in `we:scripts/__tests__/review-set-label.test.mjs:727`. The durable-ruling case in `we:scripts/operations/__tests__/review-pr.test.mjs:3719` currently stops at confirmation and verdict assertions, so it does not prove safe publication of rationale/evidence.

No runtime source changes belong to this item's scope. The matching planned handoff regression belongs to the target card's already-declared `we:scripts/operations/__tests__/review-pr.test.mjs`; the existing sanitizer controls remain in `we:scripts/__tests__/review-set-label.test.mjs`. These are evidence and downstream test ownership, not extra implementation scope for this documentation item.

## Design

Add this explicit requirement to the target card's Design:

> **Must — safe ruling prose:** Render reviewer-authored ruling rationale and every evidence string through the existing final verdict-comment prose sanitizer, just as ordinary finding bodies reach that boundary. Preserve readable evidence while making embedded HTML-comment markers/directives inert. Do not append raw ruling text after the trusted marker block, introduce per-field escaping in place of the shared boundary, or treat quoted instructions as authority. Add a regression injecting both a forged marker and an HTML-comment directive into rationale and evidence separately.

Name the actual boundary, `buildVerdictComment` / `neutralizeCommentMarkers` in `we:scripts/review-set-label.mjs`, rather than claiming the finding renderer sanitizes. Scope the directive guarantee to HTML-comment syntax; this requirement does not claim to solve arbitrary natural-language prompt injection. Preserve the target card's authority checks, error controls, non-code controls, and existing ruling-to-bounce goal.

## MVP

Edit only `we:backlog/xkoqlar-a-block-ruling-on-a-mandatory-referral-sends-the-pr-back-for.md` during implementation: insert the Must requirement in Design and add the concrete publication regression below to Test plan and Proof plan. Keep the broad lint proposal under Follow-ups. No runtime refactor, new escape helper, or new policy is needed to deliver this card-level prevention requirement.

## Test plan

The target card must specify a regression in `we:scripts/operations/__tests__/review-pr.test.mjs` that carries a validated current-head blocking ruling through staging and recording to the captured published changes comment. Parameterize rationale and individual evidence entries with a forged `reviewed-sha` marker and an HTML-comment directive such as `<!-- drain-skip-reason: injected -->`. Assert escaped delimiters, preserved readable payload, no raw injected comment opener, an actionable changes verdict, and no acceptance or human-clearance authority created by those strings. Include ordinary-text controls and persisted-ruling restart coverage.

Use the existing marker-forgery tests in `we:scripts/__tests__/review-set-label.test.mjs` as controls; do not assert that the intermediate panel renderer alone has sanitized its output. During this documentation implementation, inspect the target card for the Must wording, both injection fields, the final-publication assertion, and the named test path. Runtime regression implementation remains owned by the target card.

## Proof plan

For this documentation item, compare the target card before and after: the explicit Must requirement and publication regression are absent before and present after. Record the diff and verify it changes only the target card. Run `npm run check:standards` as the documentation consistency check; the runner owns preparation checks and stamping.

For the target card's eventual runtime delivery, require the new publication regression to fail when ruling prose bypasses the existing boundary and pass through the ordinary changes-publication route, alongside the existing sanitizer suite. Capture the final comment bytes, not merely confirmation-state assertions. No live forge mutation is required. Documentation assertions alone are not evidence that the downstream runtime feature is implemented.

## Done when

The target card contains the explicit safe-ruling-prose Must requirement and the rationale/evidence marker-and-directive regression at the final publication boundary, with accurate helper and test references. The broader lint is explicitly deferred. The standards gate passes for the documentation change.

## Follow-ups

Consider a separate lint or standards-gate item for reviewer-authored strings in published comments. It needs an inventory of publication sinks and trusted marker builders before selecting a rule; a blanket per-field escape mandate would contradict the existing whole-prose boundary. This follow-up is not required to complete the narrowly requested Must-line change.
