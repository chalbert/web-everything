---
kind: story
size: 2
status: resolved
scope: ["we:contracts/plateau-progress-view.schema.json", "we:contracts/plateau-progress-view.examples.json", "we:contracts/plateau-progress-view.test.ts", "we:contracts/package.json", "we:package.json", "we:package-lock.json", "we:vitest.config.ts"]
dateOpened: "2026-09-30"
dateResolved: "2026-10-01"
tags: []
---

# Publish the Plateau progress-view contract (schema 2) with validated examples

Ruling on #4289 (option a, 2026-09-30): the WE half of #4620, landed first. Publish the progress-view contract schema 2 in we:contracts/plateau-progress-view.schema.json with named positive examples in we:contracts/plateau-progress-view.examples.json (partial history, stale cache, missing trend baseline, conflicting plan, cold history, pending review or red CI without a human action) and a declarative validation test we:contracts/plateau-progress-view.test.ts that validates every example and rejects negative counts, an unknown major version and absent source freshness. A consumer can validate a snapshot independently of the UI. Design source: we:docs/agent/plateau-progress-view.md and the prepared split table in we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md.

## Done when

1. `npx vitest run we:contracts/plateau-progress-view.test.ts` (drop the repo prefix when running from WE) validates every named example and rejects negative counts, unknown major versions and missing source freshness.
2. Schema 1 remains accepted without fabricated schema-2 counts. Schema 2 preserves Flow items and the slice-1 boundary; no product collector, aggregation, relay or UI is added.
3. Run `node we:scripts/verify-lane.mjs` and `npm run check:standards`; record observed results below.

## Progress

- Published the slice-1 schema and named examples in we:contracts/plateau-progress-view.schema.json and we:contracts/plateau-progress-view.examples.json. Covers partial drain history, stale PR evidence, missing baseline, conflicting plan sections, cold history, pending review and failed CI without human actions, schema-1 compatibility, and populated running/held work.
- Added the declarative Ajv harness in we:contracts/plateau-progress-view.test.ts. Added its discovery in we:vitest.config.ts and declared Ajv directly in we:package.json / we:package-lock.json rather than depending on a transitive install. Exported both JSON artifacts through we:contracts/package.json so consumers can read them independently of the UI.
- Compatibility accepts the legacy envelope; missing progress sections remain absent for the consumer to project as unknown. The schema describes cross-field arithmetic, source joins and temporal comparisons as consumer responsibilities. Local-drain tallies cannot claim complete global merge history.
- Focused proof: `npx vitest run we:contracts/plateau-progress-view.test.ts` passed all 71 tests, including all nine named snapshots. Package dry-run confirmed both JSON artifacts are included and the test is excluded; `git diff --check` passed.
- `node we:scripts/operations/run.mjs resolve --ref=x9jwbpi` completed with one applied effect. `npm run check:standards` passed with zero errors (4,610 repository warnings); the single-card lint passed. Required lane verification completed red; details below.

### Required lane verification (2026-10-01)

`node we:scripts/verify-lane.mjs` selected the full suite because test discovery/dependency manifests changed. It completed with **841 files passed, 8 failed, 1 skipped; 24,979 tests passed, 53 failed, 35 skipped**. The new contract suite passed all 71 tests in this run. The verifier recorded red; this is **not** a green lane verification. Its chained standards step did not run because the unit suite failed; the separately invoked full standards check passed as recorded above.

| Failed suite | Failures | Observed diagnostic |
| --- | --- | --- |
| we:scripts/lib/__tests__/gh-app-shim.test.mjs | 2 | Parent-command attribution returns a session fallback/null. |
| we:scripts/__tests__/gemini-direct-task.test.mjs | 31 | Injected child is not called; quota-hold early return appears in results. |
| we:scripts/operations/__tests__/host-process-sample.test.mjs | 1 | Real process sample is empty. |
| we:scripts/conveyor/__tests__/poc-branch-sync.test.mjs | 2 | EPERM creating the host drain-lock directory. |
| we:scripts/lib/__tests__/daemon-jobs-runtime.test.mjs | 10 | Process-start probes report `spawnSync ps EPERM`; detached completion also times out. |
| we:scripts/operations/__tests__/restart-runner-io-real.test.mjs | 3 | Real process lookup returns null/no runner. |
| we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs | 3 | Live process/session scans return null or false. |
| we:scripts/operations/__tests__/heavy-queue-io-real.test.mjs | 1 | Real command lookup returns null. |

Direct environment probes: invoking the system process-list command returned `Operation not permitted`; reading `readAgyHold()` from we:scripts/lib/antigravity-run-evidence.mjs returned `skip-quota-hold` with reset `2026-10-04T17:31:18.942Z`. The process lookup and host-write tests require permissions unavailable in this sandbox; the quota-sensitive tests read host state. No host quota state, permissions, tests, or admission limits were changed to hide these failures. No commit, push or PR was made.

## Follow-ups

- Consumer #4620 must retain its relay/client compatibility, runtime aggregation, source-key joins, timestamp ordering, phone rendering and no-new-GitHub-call proofs. This card validates declarative snapshots only; it does not prove deployed product behavior.

- Verification lesson: process-table tests need a permitted host, and quota-sensitive process-mechanics tests need an isolated hold reader. Re-run the full gate in that environment before landing; do not treat this contract-only proof as a green repository gate.
