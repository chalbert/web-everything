---
bornAs: xnoooq9
kind: story
size: 8
status: open
scope: ["we:scripts/conveyor/credential-inventory.mjs", "we:scripts/conveyor/__tests__/credential-inventory*.test.mjs", "we:scripts/conveyor/health-smells/credential-inventory-stale.mjs", "we:scripts/conveyor/health-smells/__tests__/credential-inventory-stale*.test.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "b1e5ed4e294f5ca43e9e7da64fcf8d468bf478f4"
tags: []
---

# Plateau: credential inventory and rotation tracker

The operator reported that plateau-app's static `FUI_READ_TOKEN` expired on 2026-09-28 and blocked
PRs until manual rotation. Preserve the goal: make aging credentials and credential-related CI failures
visible before another silent outage. The MVP provides rotation-review signals and failure detection;
repository-secret metadata alone cannot promise advance warning of actual token expiry.

## Progress

Preparation research, 2026-09-30 (no implementation or preparation stamp):

- **Old premise/scope:** one inventory script and one smell were sufficient; scope also named
  we:scripts/lib/github-app-token.mjs, we:scripts/conveyor/pr-events-worker/wrangler.toml,
  plateau:.github/workflows/ci.yml and we:.github/workflows/ci.yml, without matching tests.
  Secret age was described as a specialization of “expires within N days.”
- **Corrected premise/scope:** implement the inventory, pure smell, and its actual probe wiring in
  we:scripts/conveyor/health-watch.mjs, with matching tests for all three. Workflows, the minter,
  and Worker configuration are read-only evidence, not MVP edits. Age means “review rotation,” not
  “expired”; a recent secret update is not proof that its underlying credential works.
- **Source evidence:** at WE HEAD `b1e5ed4e294f5ca43e9e7da64fcf8d468bf478f4`, neither proposed
  credential-inventory module exists and path history has no delivering commit.
  we:scripts/conveyor/health-smells/index.mjs discovers descriptors automatically, but
  we:scripts/conveyor/health-watch.mjs:791 supplies the GitHub-cadenced probes explicitly.
  Merely adding a descriptor would leave the new probe absent.
- **Existing coverage is narrower:** we:scripts/conveyor/health-smells/bad-credentials.mjs evaluates
  daemon-log memory and App-apply status, not Actions failure logs.
  we:scripts/conveyor/health-smells/github-app-token.mjs already monitors installation-token expiry.
  Neither supplies repository-secret inventory. Reuse their ecosystem without duplicating those signals.
- **Workflow citation verified:** plateau:.github/workflows/ci.yml:65 still consumes `FUI_READ_TOKEN`,
  as does its second sibling checkout at line 120, in Plateau checkout
  `1888d29aa5b82b48a09683d8017c9886eaef2f5e`.
  we:.github/workflows/ci.yml:103 also consumes it. This verifies the dependency, not the historical
  expiry incident's cause; the latter remains the operator's report. #4382 remains open in
  we:backlog/4382-plateau-app-ci-mint-a-short-lived-github-app-token-instead-o.md.
- **Fuller-design drift:** environment configuration and the single shared installation-token cache
  belong to we:scripts/lib/github-app-auth-env.mjs (`resolveGithubAppEnvConfig`, `defaultCachePath`),
  not the minter and not a per-repo cache. we:scripts/lib/github-app-token.mjs mints tokens and returns
  `expiresAt`. Do not open token-cache contents for this MVP. The Worker secret names remain documented
  in we:scripts/conveyor/pr-events-worker/wrangler.toml:10.
- **Access evidence:** we:scripts/lib/github-app-auth-env.mjs:50 declares Actions read but no Secrets
  permission. GitHub's [repository secrets API](https://docs.github.com/en/rest/actions/secrets#list-repository-secrets)
  requires Secrets read for fine-grained credentials and returns names/timestamps, not secret values or
  expiry. Do not silently broaden the fleet App's permissions or switch identities to make this work.

## Design

**Placement and boundary.** This is operational monitoring of the existing WE delivery fleet, alongside
we:scripts/conveyor/health-watch.mjs; it is not a new standard/runtime. Preserve the card's WE-side MVP.
A future served credentials panel belongs to Plateau under
we:docs/agent/platform-decisions.md#constellation-placement and
we:docs/agent/platform-decisions.md#devtools-placement. No product surface or secret mutation ships here.

**Inventory collector.** Add we:scripts/conveyor/credential-inventory.mjs with an import-safe pure
normalizer and injectable clock/command runner, plus a read-only JSON CLI. Default repositories are
`chalbert/web-everything`, `chalbert/frontierui`, and `chalbert/plateau-app`; accept explicit repo selection.
Use argument arrays and GET-only GitHub calls, paginate repository secrets, and project an allowlist of
`repo`, `name`, `updated_at`. Sort and deduplicate by repo/name. The envelope carries `schemaVersion: 1`,
`checkedAt`, per-repo collection status, secret rows, CI findings, and bounded error codes. Empty successful
listings differ from denied, unavailable, malformed, timed-out or incomplete responses. Never serialize raw
API responses, child-process error objects, authorization headers, tokens, or log lines. CLI exits nonzero
for incomplete collection while retaining successfully collected rows in JSON; an aging secret is data,
not a collector failure.

**CI failure probe.** In the same collector, list completed failed Actions runs updated within a configurable
lookback (initial diagnostic default: 24 hours), then inspect failed-step logs for the literal
case-insensitive `Bad credentials` signature. A bare `401` alone is insufficient. Use
[GitHub CLI failed-log retrieval](https://cli.github.com/manual/gh_run_view) with explicit repo, run id,
and attempt. Record only repo/run id/attempt/workflow, run URL, observed time and a boolean signature;
do not persist or print log text. A matching log establishes an authentication-failure signal, not which
secret caused it or whether it expired versus being revoked. Missing/deleted logs are unknown, not clean.
Bound commands by time/output size and the scan by a configurable run limit (initially 20 per repo);
report truncation as incomplete coverage. Reuse successful run/attempt results within the lookback so
unchanged failures do not trigger repeated downloads; retry unavailable results on the next due probe.
Persist only sanitized result metadata in watcher state, never raw logs.

**Smell and integration.** Add we:scripts/conveyor/health-smells/credential-inventory-stale.mjs using the
shape of we:scripts/conveyor/health-smells/pr-events-stale.mjs: repo scope, GitHub cadence,
`probes: ['credentialInventory']`, `openAfter: 1`, `closeAfter: 2`, medium severity, alert action.
Use two stable subjects per repo (secret-age and CI-auth) so clean complete samples close the corresponding
condition through existing episode hysteresis. Age breaches when `now - updated_at` exceeds configurable
`maxAgeDays` (initial review heuristic: 90 days, not a credential lifetime or rotation policy). Report
names and ages for stale entries. Missing/invalid/future timestamps are unknown metadata, not fresh.
CI breaches when any fully observed run within the lookback matches. The recommendation names the run
and asks the operator to verify the failing credential; it never asserts `FUI_READ_TOKEN` caused every match.

Wire collection into we:scripts/conveyor/health-watch.mjs on its existing GitHub cadence. Honor `--no-gh`,
provide an explicit inventory fixture flag for isolated tick tests, and ensure unrelated probe failures
cannot suppress this probe. Keep collection timeout within the tick watchdog budget. Successful partial
observations may open a finding; incomplete/unknown samples must not emit clean results or close existing
episodes. Surface coverage errors through the existing probe-error reporting, including Secrets permission
denial. The collector uses the caller's identity; no changes to App grants, authentication helpers or workflows.
No edit to the disk-discovered registry is needed.

**Operator response.** An age alert asks the repository owner to inspect the named secret's consuming
workflow and issuer's expiry metadata, obtain a replacement with the intended access, update the repository
secret through the normal operator channel, rerun the affected job, and record successful verification.
Never put the replacement value in this tool or its output. An API timestamp is only last update;
issuer expiry, credential ownership, and last verified use remain unknown unless separately supplied later.

## MVP

1. Implement the read-only inventory and bounded failed-CI-log collector in
   we:scripts/conveyor/credential-inventory.mjs, including explicit coverage/error status.
2. Implement the two-condition pure smell in
   we:scripts/conveyor/health-smells/credential-inventory-stale.mjs and wire it into
   we:scripts/conveyor/health-watch.mjs so it actually participates in health ticks.
3. Add fixture tests under we:scripts/conveyor/__tests__/credential-inventory*.test.mjs and
   we:scripts/conveyor/health-smells/__tests__/credential-inventory-stale*.test.mjs; extend
   we:scripts/conveyor/__tests__/health-watch.test.mjs for integration and cadence.
4. Deliver useful names/timestamps and authentication-failure pointers across the three repositories,
   with unknown coverage visible. Do not rotate credentials, mint new tokens, edit workflows, or send
   new reminder notifications. #4382's short-lived CI-token migration remains independently useful.

## Test plan

- **Collector — we:scripts/conveyor/__tests__/credential-inventory*.test.mjs:** injected GET/CLI fixtures
  for all three repos, multiple pages, duplicate names across repos, empty results, sorted output,
  malformed responses, access denied, partial pagination, timeouts and output/run limits. Fixed-clock tests
  cover lookback edges and run attempts. Verify a signature in a failed-step log is detected; ordinary test
  failures, a bare 401, successful runs and out-of-window failures are not classified as credential failures.
  Test missing logs, cache reuse, new attempt invalidation and retry after a failed fetch. Plant fake secret
  canaries in extra API fields, log text and process errors; assert none reaches stdout, stderr or stored
  metadata. Assert no write API, local-secret read, token mint or credential mutation is invoked.
- **Smell — we:scripts/conveyor/health-smells/__tests__/credential-inventory-stale*.test.mjs:** registration,
  fresh/over-threshold/exact-boundary age, custom threshold, invalid/future timestamps, matched/unmatched CI,
  mixed coverage, and independence of the two subjects. Feed the descriptor through the existing health core
  to prove one breach opens, two complete clean samples close, and unavailable samples preserve episodes.
  A failure leaving the configured lookback clears only the windowed finding, not a claim of credential repair.
- **Wiring — we:scripts/conveyor/__tests__/health-watch.test.mjs:** force an isolated tick with inventory
  fixtures and temporary state; assert the actual health output contains both findings, later complete clean
  ticks close them, and partial probes do not. Verify no live collection with `--no-gh`, fixture mode or a
  non-due cadence, plus continued collection when another GitHub probe fails. Inspect persisted state for
  canaries and cached safe run metadata. Every source entry in scope has a matching existing/planned test.
- Run affected Vitest files and `npm run check:standards` during implementation; this preparation changes
  only the card. The probation runner owns preparation checks and stamping.

## Proof plan

1. Before implementation, demonstrate that importing the two proposed modules fails because they are
   absent, and that current health output cannot list repository-secret age. After implementation, run the
   new fixture suites and the real watcher tick over isolated fixtures; capture exit status and sanitized
   inventory/episode output, including a stale row and a failed CI run with the signature.
2. Run the inventory CLI read-only against the three real repositories using the intended deployed identity.
   Compare names/timestamps and pagination counts with the repository metadata API. Capture only allowlisted
   metadata and coverage codes. Denied access proves honest unavailability, not working inventory coverage;
   full live inventory acceptance requires an operator-provided identity already authorized to read secrets
   metadata. Do not grant permissions or extract secret values as part of proof.
3. If a retained real failed run has the signature, compare its run/attempt pointer with the collector's
   boolean result without attaching raw logs. Otherwise label CI detection fixture-proven only; do not
   deliberately invalidate a credential or manufacture an outage for a live demonstration.
4. Observe a real due health tick using the installed code and verify the new probe runs and its sanitized
   output reaches the existing health report. Pair it with the isolated open/close test; no new notification
   delivery or external writes are needed. Record coverage limitations and all commands/results when building.

## Follow-ups

- Extend inventory to organization/environment secrets, declared owner, consuming source/workflow,
  credential kind (static versus minted), issuer expiry, last verified use, and per-entry rotation instructions.
  PAT-expiry-header probing requires an authorized context holding that PAT; repository metadata cannot supply it.
- Add local secret-file name/mtime and App-key metadata without reading key contents. Reuse the existing
  App-expiry monitor in we:scripts/conveyor/health-smells/github-app-token.mjs and configuration ownership in
  we:scripts/lib/github-app-auth-env.mjs rather than a new per-repo token cache or minter edit.
- Manually tracked Worker credentials remain the names in we:scripts/conveyor/pr-events-worker/wrangler.toml;
  local metadata must not be presented as proof of the deployed secret's rotation date. CLI login status and
  WIP relay credential tracking remain outside this MVP.
- Plateau credentials panel and advance reminders are separate product work, consuming sanitized inventory.
  Relate static-token rows to #4382's migration without making either card depend on the other.
