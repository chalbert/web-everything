---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:agent-memory-src/story-preparation-checklist.md", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs", "we:scripts/__tests__/check-backlog-item.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "58807e33cb917f1130816723c975a71129d52af5"
tags: []
---

# Prevention — Add a design-card checklist item, enforced by a check:standards rule on cards that add HTTP endpoints,… (from chalbert/web-everything#3403 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

The approval requested two prevention measures: require a data-sensitivity/redaction decision and its test for routes exposing agent/tool output, and require an explicit Security/CORS test assertion for new HTTP routes. The original citations to lines 39 and 35 of `we:backlog/2778-live-output-tail-for-a-running-build.md` are historical; the current epic's Design and Test plan are the relevant context, not stable line-number anchors.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3403@a419a5273b97f2b5a37ac4e896e32d1b1bc6d56f

## Progress

Preparation research, 2026-10-03 (source inspection and a direct lint probe; no implementation or product HTTP verification):

- **Old premise/scope:** modifying only `we:backlog/2778-live-output-tail-for-a-running-build.md` would deliver a reusable checklist and executable prevention rule. **Corrected premise/scope:** that card is now an open umbrella epic with a split into child stories. Editing it cannot enforce future endpoint designs. This story owns the authoring checklist and the shared card-body lint, with matching rule and CLI tests; the product route remains outside this story.
- **Source evidence:** `we:agent-memory-src/story-preparation-checklist.md` requires design, interfaces, acceptance and tests, but has no endpoint-specific sensitivity/redaction or Security/CORS requirement. `we:scripts/check-standards-rules.mjs` exposes `lintBacklogItemRendering({ item, body, pocRegistry, knownBacklogIds })`, returning string arrays `errors` and `warnings`. Its existing test-plan and Must-coverage checks do not enforce the requested endpoint decisions.
- **Consumer evidence:** `we:scripts/check-standards.mjs` calls that shared lint in its body/rendering loop; `we:scripts/check-backlog-item.mjs` also calls it and exits 1 on errors. Neither consumer needs a new implementation branch. Existing matching tests are `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` and the real subprocess tests in `we:scripts/__tests__/check-backlog-item.test.mjs`. The former will also cover the checklist's documented examples.
- **Observed gap:** called the shared lint with an open story whose Design says “Add HTTP GET /api/run/output exposing agent and tool output” and whose Test plan only says “Capability: returns output (Red today).” Actual result: `errors: []`, `warnings: []`. The requested guard is not already delivered at this seam.
- Size 3 remains plausible: one checklist addition, one shared rule, and existing test-suite extensions. Preparation does not claim the future rule or its tests have run.

## Design

1. Add an HTTP-endpoint checklist paragraph to `we:agent-memory-src/story-preparation-checklist.md`, alongside the design/interface/test requirements. Require an endpoint inventory under Design: one entry per new method/path, its returned data, a `Data sensitivity:` decision, and a `Redaction:` decision (including an explicit reason when none is needed). Require a matching `Security/CORS:` assertion under Test plan for every new route, naming the expected allowed/denied origin behavior. For routes exposing agent or tool output, also require an `Output safety:` assertion naming a representative sensitive payload and the expected redacted/withheld result, or the explicitly justified unredacted exposure boundary. This demands a stated decision, not a universal redaction algorithm or authentication policy.
2. Implement the detector in `we:scripts/check-standards-rules.mjs` and compose it into `lintBacklogItemRendering`. Keep filesystem reads out of the rule. Apply to unresolved implementation cards (story/task/bug) with endpoint additions in Design or MVP. Identify additions using an affirmative add/create/expose/introduce/register/serve verb together with HTTP/route/endpoint/SSE and a method/path or explicit endpoint inventory. Ignore fenced examples, quotations, Progress/history, and Follow-ups. A detected addition without a usable method/path is an error asking for an inventory, not a silent exemption. An explicit inventory is authoritative for enumerating multiple routes; natural-language detection is a safety net, not a claim of complete semantic understanding.
3. Match assertions by method/path, not merely the presence of section-wide keywords. For each inventoried route, require substantive sensitivity and redaction text and the Security/CORS test assertion. Agent/tool output declarations additionally require Output safety. Empty values, TODO/TBD placeholders, and unrelated route assertions do not satisfy the rule. Diagnostics name the card, route and missing field. Put violations in `errors` so both existing consumers refuse them. Do not accept an unrelated generic “security tested” line.
4. Preserve current checks and resolved-card behavior. Non-endpoint cards, route consumers without a new served endpoint, quoted historical examples and deferred endpoint follow-ups stay outside this rule. Test those boundaries explicitly. Run a read-only corpus audit before delivery; inspect every hit for classification mistakes and report genuine existing omissions. Do not quietly weaken errors to warnings or mass-author security decisions for other cards. Any required corpus correction must be reviewed as its own scope expansion before landing.
5. Implement in order: checklist examples and failing tests; pure rule and shared-lint wiring; subprocess tests; corpus audit and full gate. Land checklist, rule and tests together. Existing consumers already share the seam, so no duplicate checker, new frontmatter field, product route change or standard API is required.

## MVP

**Must**
1. The preparation checklist specifies a per-route sensitivity/redaction decision, Security/CORS assertion, and the extra agent/tool-output safety assertion.
2. Both card-checking entry points reject detected endpoint additions missing the required decisions/assertions, with actionable route-specific errors.
3. Complete endpoint cards pass this new rule; non-endpoint and historical material retain their existing behavior.

## Done when

- Must 1: the checklist contains complete ordinary-route and agent-output-route examples, and tests exercise those examples against the rule so documentation cannot prescribe an accepted-looking but rejected shape.
- Must 2: the new negative rule and subprocess assertions fail on the base and pass with the rule installed. A card with two routes and safety text for only one reports the uncovered route. Removing each required field independently causes refusal.
- Must 3: positive and exclusion fixtures pass, and the read-only corpus audit has no unexplained hits. `npm run check:standards` passes before implementation delivery; existing omissions are corrected explicitly rather than hidden by the detector.

## Test plan

- **Capability — RED on base:** extend `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` with ordinary and agent/tool-output routes, missing sensitivity, missing redaction, missing Security/CORS, missing Output safety, placeholders, duplicate/multiple routes, route-mismatched assertions and a detected addition lacking method/path. Assert route-specific errors through the shared lint, not only through a helper.
- **Capability — RED on base:** extend `we:scripts/__tests__/check-backlog-item.test.mjs` using its temporary-card/cleanup pattern. Run the actual CLI for a deficient endpoint story and require exit 1 plus the diagnostic; complete that same card and require exit 0. Exercise the checklist examples in the rule suite, reading the documented example blocks from `we:agent-memory-src/story-preparation-checklist.md`.
- **Preservation — GREEN on base and changed code:** in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`, cover non-endpoint stories, resolved cards, client-only HTTP consumption, quoted/fenced examples, Progress and Follow-ups, and complete endpoint declarations. Mutation proof: broaden detection to all HTTP mentions or remove section/status exclusions; the exclusion assertions must fail.
- **Preservation — GREEN on base and changed code:** retain existing shared-lint and subprocess cases. Mutation proof: disconnect an existing locus-prefix check or suppress existing rendering errors; its existing assertion must fail. The new rule must not replace earlier checks.

## Proof plan

Implementation acceptance, not results claimed during preparation:

1. Run `npx vitest run` against `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` and `we:scripts/__tests__/check-backlog-item.test.mjs` from WE, resolving the repository prefixes to local paths. Preserve the baseline RED and implemented GREEN results for the new refusal cases.
2. In an isolated checkout, feed one deficient temporary endpoint story through the real per-item CLI and the whole-repository gate. Record the same missing-field diagnostic and nonzero exit in both, then fill the required decisions/assertions and record disappearance of that diagnostic. Remove the temporary card afterward. This catches a pure rule that never reaches the real gate.
3. Audit all current cards through the proposed rule without rewriting them. Record each hit and its classification; repair false positives with regression fixtures. Report real omissions rather than treating unrelated gate failures as proof this rule works.
4. Run `npm run check:standards` and retain the final outcome. A product server/browser probe is unnecessary for this authoring guard: its observable behavior is acceptance/refusal of card content. Endpoint implementations remain responsible for actually executing their declared security tests.

## Follow-ups

- Source-code discovery of undocumented endpoints and judging the adequacy of a chosen redaction/access policy are separate work; this guard proves that the card states decisions and route-specific test assertions.
- Corpus omissions found during the implementation audit require explicit author decisions and reviewed scope; do not fabricate those decisions to turn the gate green.
- Independent preparation review and stamping remain with the probation runner. This edit neither stamps nor claims implementation completion.
