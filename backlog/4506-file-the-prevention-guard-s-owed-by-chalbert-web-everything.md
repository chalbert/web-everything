---
bornAs: x9p3pnn
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:.github/pull_request_template.md", "we:scripts/__tests__/pull-request-template.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-01"
preparedAgainstSha: "642f38e12d87b4e90a7ef2c24aabd6587c2f4593"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2956's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4497-gh-throttle-logs-a-hardcoded-default-graphql-cost-per-call-i.md` — A PR template checklist for backlog items that explicitly prompts authors to include test cases for both the happy path and any fallback/default paths.
2. `we:backlog/4498-dispatch-plan-s-already-done-ground-truth-check-has-no-per-i.md` — A rule in check:standards or a template prompt requiring soak-break proof plans to cover the resumption of normal behavior after any suppression or limiter window.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2956@405152603e7b00e7bc95b059b6870e46f664118e

## Progress

- **Old premise and scope:** the mechanically filed card scoped edits to the two incident cards, without identifying where either reusable prevention prompt would live. Its executable acceptance was a TODO.
- **Corrected premise and scope:** deliver the two owed prompts together in a new default PR template, `we:.github/pull_request_template.md`, with a matching planned content-contract test, `we:scripts/__tests__/pull-request-template.test.mjs`. Inspection of tracked files under `we:.github/` found no existing PR template. The incident cards are provenance, not implementation targets. The second owed guard explicitly permits a template prompt; use that permitted form without introducing a new standards rejection policy.
- **Source evidence:** `we:scripts/lib/gh-throttle.mjs:1409-1415` appends the supplied entry unchanged apart from a timestamp. Its missing measured-cost aggregate is still separate work in #4497, whose current preparation already includes missing-cost and capture-disabled cases. This item provides the reusable authoring reminder, not that runtime fix.
- **Source evidence:** #4498 is resolved. `we:scripts/readiness/dispatch-plan.mjs:900-937` now combines local facts and cached verdicts with a detached refresh; the old every-tick burst narrative is not the current implementation. `we:scripts/readiness/__tests__/already-done-cache.test.mjs:26-30` already checks expiration at and beyond each cooldown boundary. `we:scripts/conveyor/soak/breaks/already-done-burst-unattributed.mjs` exercises twenty attributed calls in one burst; its run/judge do not exercise suppression followed by resumption. Neither existing cache tests nor the incident's resolution supplies the reusable proof-plan prompt owed here.
- **Preparation boundary:** only this card is edited. No runtime behavior, incident status, preparation stamp, or implementation test is changed. Size 3 remains appropriate for one template and its focused contract test; independent review remains with the runner's parked review.

## Design

Add the default GitHub PR template at `we:.github/pull_request_template.md`. Keep it concise: a change summary, linked backlog item(s), validation evidence, and a conditional backlog-item checklist. Apply the checklist to PRs that prepare backlog items as well as PRs implementing them, so the missing case is caught while authoring the plan.

The checklist must ask authors to identify test cases and expected outcomes for the happy path and every applicable fallback/default path. For preparation PRs, planned test file/case references are sufficient; implementation PRs should supply results. Permit an explicit not-applicable explanation when there is no fallback/default branch, instead of encouraging an unexamined checked box.

For soak-break proof plans involving suppression, cooldowns, or limiter windows, ask for three observable phases: normal behavior before suppression, reduced/absent work during the window, and resumed eligible work after the window ends. Require the clock-advance/reset trigger, expected call counts or other observable outcome, and the fixture/test reference. A proof of zero calls during suppression alone does not establish recovery. Permit a reasoned not-applicable response for changes without such a window.

These are review prompts, not automated judgments about proof quality. The matching test protects the presence and conditional wording of the prompts; reviewers assess the supplied evidence. No runtime interface, frontmatter schema, existing card migration, or new standards rule is required. GitHub's default PR authoring flow is the consumer; tools that supply their own PR body may bypass the template and are not claimed to be covered.

## MVP

1. **Must 1:** create `we:.github/pull_request_template.md` with the two conditional checklist prompts, evidence placeholders, and not-applicable explanations described above. Keep all authored repository file references qualified.
2. **Must 2:** add `we:scripts/__tests__/pull-request-template.test.mjs` using Vitest and a repository-root-relative file read. Assert that the actual default template contains both prompts and their evidence requirements. Land the template and test together; no production rollout or data migration is needed.

## Test plan

In planned `we:scripts/__tests__/pull-request-template.test.mjs`, read the default template from disk and check the backlog/preparation applicability, happy-path and fallback/default coverage, and the explicit not-applicable explanation. Separately check that the soak-break prompt covers all three phases, the window-ending trigger, an observable expected result, and fixture/test evidence. Use focused section assertions rather than a whole-file snapshot, allowing unrelated wording to evolve.

Demonstrate that deleting either checklist entry fails its corresponding assertion; deleting only the resumption requirement must also fail. This verifies the reminder's durability, not whether a runtime limiter actually recovers. Review a filled example for each incident: a declared default with no measured cost for #4497, and eligible checks resuming after a suppression window for #4498. An unrelated change should be able to explain non-applicability without inventing a soak break.

## Proof plan

During implementation, run the new suite with Vitest before creating the template and retain its missing-template failure. Create the template and rerun the identical suite, requiring success. Temporarily remove the post-window resumption prompt, require failure again, then restore it and require success. Record the command, exit status, and relevant output for review. The focused command is `npx vitest run we:scripts/__tests__/pull-request-template.test.mjs` with the repository-locus prefix removed from the CLI argument when executed from the WE checkout.

Run `npm run check:standards` after implementation. Inspect the rendered Markdown checklist locally and verify that the template is at GitHub's default discovery path; opening a PR is not necessary for this bounded content change. Explicitly report that custom-body automation is outside this proof. Preparation itself leaves execution of these implementation checks to the builder and stamping/checks to the runner.

## Done when

1. **Must 1:** the default PR template prompts backlog authors for happy-path and fallback/default test evidence, and for observable recovery after any soak-break suppression/limiter window, with conditional applicability and explained exceptions.
2. **Must 2 — executable:** the focused template suite fails with the template absent or either owed prompt removed and passes with the complete template restored. The standards gate passes, and review confirms that the prompts ask for evidence rather than only checkbox completion.

## Follow-ups

Custom-body PR automation may need the same prompts at its own authoring seam if review later demonstrates that bypass. That integration and any machine-enforced proof-plan policy are separate work, not prerequisites for the template option already authorized here. The measured-cost implementation remains in #4497; do not reopen #4498 or change throttle/dispatch behavior to deliver these authoring guards.
