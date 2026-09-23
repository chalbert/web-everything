---
kind: story
size: 3
parent: "xjtmptc"
status: open
scope: ["we:scripts/lib/telemetry-summary.mjs", "we:scripts/__tests__/telemetry-summary.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# telemetry-summary core: Claude usage week, per-day by model, by role, cache and output from the OTel day files

Pure core (no fs, no clock) that turns claude-otel-collector records into the usage half of the TelemetrySnapshot v1 in plateau:docs/telemetry-page.md: the plan week (renews Friday 16:00 America/New_York, DST-safe), per ET day by model family, byModel, byRole, previousWeek, today tokens/cache/output, last10, gap days as null never 0, and an allowlist projection so no session id, email or account id reaches the output.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/telemetry-summary.test.mjs` passes (the file does not exist before this item).
   Fixture records cover: a week spanning the DST change (the window starts at Friday 16:00 America/New_York on both sides),
   records before the window (excluded), a model id per family plus an unknown one (`other`), all three `query_source`
   values plus an unknown one (`other`), an ET day with no records inside the window (`usd: null`, `incomplete` names it,
   `totalUsd` excludes it), and a UTC-midnight record that belongs to the previous ET day.
2. Exact expected totals: per-day by family, `byModel` and `byRole` each sum to `totalUsd` exactly (to the cent).
3. `cacheHitPct = cacheRead / (cacheRead + cacheCreation + input)`, `null` when the denominator is 0.
4. The output holds no `session.id`, `user.*`, `organization.id` or email value — a test serialises it and greps for the
   fixture's identity strings.
5. Pure: the module imports no `node:` specifier (asserted by a test reading its import lines); `now` is a parameter.
