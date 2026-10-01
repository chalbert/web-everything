---
bornAs: xhc27ia
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/ci-auth-diagnosis.mjs", "we:scripts/conveyor/__tests__/ci-auth-diagnosis.test.mjs", "we:scripts/conveyor/ci-heal-escalation-mark.mjs", "we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs", "we:skills-src/conveyor/fix-agent-ci-brief.md"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-01"
preparedAgainstSha: "792afe7249e1d5ba391800b3448254090030facd"
tags: []
---

# bad-credentials smell names the failing secret and repo

The reported 2026-09-29 incident (~5:20 PM ET) was a Bad credentials failure at Checkout FUI (sibling), attributed by the incident reporter to an expired FUI_READ_TOKEN in chalbert/web-everything, last set 2026-07-02. The reporter describes an initial rotation of the wrong credential and subsequent investigation through PR #2999. Preserve that operational goal: a CI credential escalation should identify the failing step, consuming repository, referenced secret, its available last-updated metadata, and the command the operator can use to rotate it. The incident's expiry and historical update date are reported history, not facts established by the current checkout or by a 401 alone.

## Progress

- **Old premise/scope:** enrich bad-credentials::github-auth under we:scripts/conveyor/health-smells/ and we:scripts/conveyor/github-app-status.mjs as though they already receive CI run evidence. Neither original scope entry included its tests.
- **Corrected premise:** we:scripts/conveyor/health-smells/bad-credentials.mjs evaluates daemon error timestamps and App status only; it has no run, job, workflow, repository-secret mapping, or CI log input. we:scripts/conveyor/github-app-status.mjs reads the last host App-auth status and formats it; it does not inspect Actions secrets. A preparation-time direct invocation with three synthetic daemon errors returned only the aggregate count and generic shim/App recommendation. A direct invocation of buildCiHealEscalationComment in we:scripts/conveyor/ci-heal-escalation-mark.mjs with reason Bad credentials returned that reason without any secret context. This goal remains undelivered in those paths.
- **Source evidence:** we:.github/workflows/ci.yml contains multiple Checkout FUI (sibling) steps using actions/checkout with repository chalbert/frontierui and token expression secrets.FUI_READ_TOKEN. The checkout target is not the repository holding the workflow secret. we:skills-src/conveyor/fix-agent-ci-brief.md already tells the healer to inspect failing run logs and invoke we:scripts/conveyor/ci-heal-escalation-mark.mjs against the captured EXAMINED_HEAD. That marker builds the durable comment and preserves it through the existing owed-write mechanism. we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs already tests comment round-trips and the brief's captured-head contract.
- **Corrected scope:** take the original card's expressly permitted CI-heal escalation route. Add we:scripts/conveyor/ci-auth-diagnosis.mjs and its matching planned test we:scripts/conveyor/__tests__/ci-auth-diagnosis.test.mjs; extend the marker and its existing test; update the CI-heal brief, whose matching tests also live in we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs. Remove the host smell directory and App-status module from implementation scope. The workflow is read-only evidence, not a proposed edit. No historical run log was retrieved during preparation; the replay below remains delivery proof to perform.

## Design

1. Add a read-only diagnostic helper in we:scripts/conveyor/ci-auth-diagnosis.mjs, with an injectable GitHub reader and a pure evidence-to-diagnosis formatter. Input is an explicit repository slug, run ID, run attempt, and the head already examined by the healer. Read run/job metadata and failed-step logs, then the workflow revision actually executed by that run. Verify run repository and revision/PR association with the examined head; account for pull-request merge revisions rather than assuming run head SHA always equals PR head SHA. A mismatch yields an unavailable diagnostic, never attribution to a different head.
2. Correlate the authentication failure to a failed job and step, and the step to its workflow job/step definition. For MVP, resolve a direct literal checkout token reference such as secrets.FUI_READ_TOKEN (including literal bracket notation). Repeated step names across jobs must not be resolved by the first name match. Emit run/attempt, job/step, workflow revision, consuming repo, and referenced secret as evidence. Describe this as the credential referenced by the failed step; a 401 and a last-updated date do not prove expiry.
3. Read repository secret metadata with `gh secret list --repo chalbert/web-everything --json name,updatedAt` (substitute the explicit consuming repository). Match by exact name. Report the update timestamp and metadata observation time; historical replays must distinguish present metadata from incident-time metadata. Never fetch or print secret values, raw logs, unrelated workflow contents, or credential-bearing command errors. Use the existing throttled GitHub reader in we:scripts/lib/gh-throttle.mjs, bounded calls/timeouts, argument arrays, and injected readers for tests.
4. When a direct repository-secret mapping is unambiguous, render the operator command `gh secret set FUI_READ_TOKEN --repo chalbert/web-everything`, which prompts for the replacement value. Display it only; never execute it. If metadata cannot be read, keep the known step/repo/reference and state that the date is unavailable. Dynamic expressions, multiple candidates, environment/organization ownership ambiguity, reusable workflows, missing logs, and unmatchable jobs return explicit unresolved details without a guessed rotation target. An absent repository-list entry does not prove a missing secret.
5. Extend we:scripts/conveyor/ci-heal-escalation-mark.mjs with optional run/attempt flags and an optional structured diagnostic input to its pure comment builder. Enrichment appends a human-readable section after existing marker fields; preserve marker identity, outcome, captured head, parser compatibility, and owed-write behavior. Failed enrichment must not prevent the original escalation. Existing invocations without run context behave as before. Update we:skills-src/conveyor/fix-agent-ci-brief.md to pass the diagnosed run/attempt for CI authentication failures and use the existing needs-human outcome when operator credential replacement is required. Do not introduce a new outcome or change retry policy.

## MVP

- Implement the helper and deterministic attribution for the direct checkout-secret case, then wire the real escalation CLI and brief to it. Keep diagnostic collection read-only and lazy: no CI scan on every health tick.
- On the incident-shaped input, the rendered escalation names Checkout FUI (sibling), FUI_READ_TOKEN, chalbert/web-everything, the available metadata timestamp, and the explicit repository-scoped rotation command. It must not target chalbert/frontierui merely because that is the checkout destination.
- Partial evidence produces a useful bounded explanation instead of dropping the escalation or fabricating the secret's owner, expiration, or update date. Existing host-auth diagnostics retain their existing behavior.

## Test plan

- In planned we:scripts/conveyor/__tests__/ci-auth-diagnosis.test.mjs, embed sanitized run/job/log/workflow/secret-metadata fixtures. Cover the incident-shaped direct reference, bracket syntax, duplicate step names across jobs, multiple failed steps, matrix jobs, wrong repo/head/attempt, and workflow revision differing from the local checkout.
- Cover non-auth failures, multiple/dynamic secret references, environment/reusable-workflow ambiguity, missing or deleted logs, denied secret metadata, absent metadata entry, malformed responses, timeout, and throttling refusal. Assert no guess becomes a confirmed rotation command. Inject canary secret values into irrelevant fields/errors and assert none reaches the diagnostic output.
- Extend we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs to exercise collection through the CLI's injectable orchestration seam, final rendered comment, enrichment failure fallback, unchanged parsing/head semantics, and enriched-body preservation on owed writes. Extend the existing brief checks to require the run/attempt arguments on the auth escalation path while retaining EXAMINED_HEAD.
- Run the affected tests with Vitest and the repository standards gate during delivery. No production credential changes or PR comments are needed for tests.

## Proof plan

1. Before implementation, add the incident-shaped regression to we:scripts/conveyor/__tests__/ci-auth-diagnosis.test.mjs and the rendered-comment integration assertion to we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs. Run both with `npx vitest run` (pass those WE-relative test paths from the WE repository root); record the expected red result for missing attribution, then the green result after implementation.
2. Retrieve run 36632379377 from chalbert/web-everything read-only, including its attempt, jobs, failed-step log, and executed workflow revision. Replay sanitized evidence through the same collector/formatter and comment builder without posting. Record whether the evidence actually supports Checkout FUI (sibling) → FUI_READ_TOKEN → chalbert/web-everything. Preserve only allowlisted metadata in the proof output.
3. Label any live secret-list timestamp as observed now. Use 2026-07-02 only if historical evidence establishes it; do not manufacture that timestamp from the current list. If the historical run has expired or is inaccessible, record that limitation and supply a clearly labeled synthetic replay plus a read-only replay from an accessible equivalent run; do not claim the historical replay passed.
4. Inspect the final comment for the explicit rotation target, no secret values, preserved head/outcome, and actionable partial-data behavior. Run `npm run check:standards`. The preparation worker does not execute delivery checks or stamp this card; the runner owns preparation checks and stamping.

## Done when

The incident-shaped regression fails before implementation and passes afterward through the real escalation composition path; the proof identifies the exact credential reference and consuming repo without claiming unobserved expiry. Every scoped source/brief has its matching tests listed above, and unavailable evidence leaves a truthful escalation.

## Follow-ups

- Extend attribution to reusable workflows, environment/organization secrets, or non-checkout credentials only with concrete failing examples and matching ownership evidence.
- A future CI-aware health probe may reuse the helper to enrich the host smell, but this delivery does not add one or conflate daemon App auth with Actions secrets.
- Automated rotation, token provisioning, expiry prediction, and retry/re-arm policy changes remain outside this diagnostic story.
