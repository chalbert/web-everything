---
bornAs: xh2341j
kind: story
size: 3
parent: "3861"
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/__tests__/gh-throttle.budget-block.test.mjs", "we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-01"
preparedAgainstSha: "c6e39f4de578937f54deaa98fa8f0367aa3f1e7e"
tags: []
---

# gh-throttle logs a hardcoded default GraphQL cost per call instead of GitHub's real reported cost, undercounting true spend

Expose measured GraphQL spend on each call-ledger entry when the captured responses actually report it. Keep the caller-declared `points` (default 1) intact: it is an admission estimate, not a measurement of GraphQL primary-budget consumption. Add an optional `realPoints` total without presenting shared-account counter movement as exclusive caller spend.

## Progress

Preparation research corrected the original premise and scope:

- **Old premise:** header capture was opt-in; consecutive same-identity `used` values represented a call's real cost; the exhaustion parser could supply the sequence. The original incident narrative cited five exhaustions on 2026-09-29, approximately one-fifth snapshot coverage, approximately 2.1 points per declared point for the fix procedure, and four counter increments for one PR edit. Those historical measurements were not reproduced in this preparation and are not acceptance evidence.
- **Current evidence:** `we:scripts/lib/gh-throttle.mjs:162-174` documents default capture for both entry points, subject to capture exclusions and the kill switch. `stripGhDebug` already extracts explicit response-body `data.rateLimit.cost`, and `rateLimitRecords` retains it as `rl[].cost` (`we:scripts/lib/gh-throttle.mjs:815-857`). The two call-log sites still pass declared `points` plus raw `rl` (`we:scripts/lib/gh-throttle.mjs:1551-1554` and `we:scripts/lib/gh-throttle.mjs:1787-1790`). `recordGhCallLogEntry` only appends the supplied entry (`we:scripts/lib/gh-throttle.mjs:1409-1415`); there is no aggregate measured-cost field.
- **Corrected premise:** `parseGhDebugResponseHeaders` retains only the last response block (`we:scripts/lib/gh-throttle.mjs:716-732`). Shared counters include concurrent traffic, and their first observation lacks a baseline. The existing accounting explicitly attributes only in-band costs and leaves legacy costs unknown (`we:scripts/lib/gh-spend.mjs:12-15`, `we:scripts/lib/gh-spend.mjs:165-186`). A delta-based `realPoints` would contradict that contract. Use existing explicit response costs instead; do not infer missing costs from counters.
- **Old scope:** the throttle source and its main and budget-block suites. **Corrected scope:** retain those paths and add the existing capture/fidelity suite, `we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs`, which exercises both entry points. No spend-report implementation changes are necessary. Historical caller references resolve to `we:scripts/conveyor/fix-procedure.mjs` (throttle import at line 544) and `we:scripts/pr-land.mjs`, not the originally stated repository-root paths; neither caller needs editing.

## Design

In `we:scripts/lib/gh-throttle.mjs`, enrich actual `outcome: 'call'` entries at the shared `recordGhCallLogEntry` boundary. Preserve `points`, `rl`, identity, invocation, attempt, and outcome fields. Derive an optional `realPoints` from the sum of explicit, nonnegative safe-integer `cost` values on GraphQL response records. Require at least one GraphQL response, an identified resource on every record, and a valid explicit cost on every GraphQL response; omit the aggregate if these conditions fail or the sum is not a safe integer. Explicit zero is measured zero, not missing data.

For mixed REST/GraphQL records, sum only GraphQL costs; document `realPoints` as measured GraphQL primary points represented by this attempt's captured records, not total cross-resource spend or proof of complete network capture. Never use the top-level resource guess to override response resource labels. An unknown response resource makes the aggregate unavailable. Partial GraphQL cost coverage must not yield a misleading complete total.

No previous-entry baseline, file reread, shared state, additional request, query rewriting, or counter subtraction is needed. Retain best-effort logging and all admission, retry, debug stripping, and budget-block behavior. Missing measurements leave the existing declared-default behavior unchanged; consumers must not describe that fallback as measured spend. Existing raw costs and spend-report attribution remain authoritative; the new aggregate is a convenience on the call line, not a replacement accounting engine.

## MVP

1. Extend the logger's documented entry shape and recording comment in `we:scripts/lib/gh-throttle.mjs` with the optional measured GraphQL total and its coverage limitation. Implement the deterministic enrichment inside the existing best-effort append boundary, without mutating the caller's entry.
2. Add focused logger fixtures in `we:scripts/lib/__tests__/gh-throttle.test.mjs` and capture-to-ledger assertions for both wrappers in `we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs`.
3. Retain the existing budget-block regression suite, `we:scripts/lib/__tests__/gh-throttle.budget-block.test.mjs`, to verify that measurement does not change exhaustion handling. No production caller edits or live GitHub traffic are required.

## Test plan

- In `we:scripts/lib/__tests__/gh-throttle.test.mjs`, append a call with declared `points: 1` and two GraphQL responses with explicit costs 2 and 3; read the ledger and assert `realPoints: 5`, unchanged `points: 1`, and unchanged raw records/input object.
- Cover zero cost, absent/empty records, one missing GraphQL cost among measured responses, negative/fractional/nonfinite/unsafe costs, overflow, unknown resource, REST-only records, and mixed resources. Non-call diagnostic entries must not acquire a measured total.
- Replay counter-only records with increasing `used`, resets, and different identities; none may acquire `realPoints`. Include an explicit-cost fixture whose counter jump exceeds its cost to prove that concurrent bucket movement cannot inflate the total.
- In `we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs`, feed complete synthetic debug blocks with response-body costs through both real wrapper capture paths, using the existing fake-process harness. Check success and failed-attempt logging, per-attempt isolation on retry, unchanged stdout/stderr, and omission when capture is disabled or costs are absent.
- Run the main, fidelity, and budget-block suites above with Vitest. This is tooling-only work; no rendered-page or standard conformance demo changes are involved.

## Proof plan

The executable regression is the two-response logger fixture in `we:scripts/lib/__tests__/gh-throttle.test.mjs`. Run it with Vitest's test-name filter before implementation: current code preserves `points: 1` but has no `realPoints`, so the expected total of 5 must fail. Run the identical fixture after implementation and require it to pass. Preserve the RED/GREEN output for review.

Then run the three scoped test suites and the standards gate (`npm run check:standards`). Inspect the temporary ledger produced by the wrapper fixtures: each attempt must show the declared value alongside the measured total when available, with raw response evidence sufficient to recompute that total. A counter-only fixture must still lack the measured field. These controlled probes prove the logging contract; they do not claim to reproduce the historical production incident or establish complete account-wide attribution. The runner owns preparation stamping and checks; this preparation does not implement or execute the proposed regression.

## Done when

The regression above fails on the original logger and passes after the change; both wrapper paths emit the measured GraphQL total from complete explicit-cost records, preserve declared points and caller-visible behavior, and leave unmeasured costs unclaimed. All scoped suites and the standards gate pass.

## Follow-ups

Increasing explicit-cost coverage for queries that do not return `rateLimit.cost`, changing report presentation, and measuring production capture coverage are separate work. Do not silently rewrite queries, enable extra requests, or relabel counter deltas as caller costs in this item. No follow-up is required to ship the bounded logging improvement.
