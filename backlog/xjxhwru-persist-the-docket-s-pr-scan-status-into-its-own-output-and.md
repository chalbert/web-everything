---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/gen-decision-docket.mjs", "we:scripts/lib/decision-docket-data.mjs", "we:scripts/lib/open-pr-items.mjs", "we:scripts/check-readiness.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Persist the docket's PR-scan status into its own output, and refuse/warn instead of silently emitting an empty in-review list

we:scripts/gen-decision-docket.mjs's data step silently swallows a failed open-PR scan. we:scripts/lib/open-pr-items.mjs's openPrsByItem is fail-soft: a gh pr list error on the primary repo returns {nums:[], unavailable:true}; a sibling-repo (frontierui/plateau-app) failure returns {partial:[...]} while keeping the primary's numbers. we:scripts/check-readiness.mjs's if (prSet.size) guard then skips building inReview entirely whenever the scan came back empty, so the committed we:reports/decision-docket-data.json shows inReview:0 and every item's pr field nulled with NO failure marker in the output — indistinguishable from a real all-clear. Confirmed live on PR #2456: two open PRs (#2443, and #2442 which merged 3 min after the report's own generatedAt) were missing from the data as a direct result, and the PR was bounced review:changes by a human operator over exactly this. Fix: add a top-level prScanOk (or similarly named) field to we:reports/decision-docket-data.json reflecting whether the scan that produced it actually succeeded (covering both the unavailable and partial cases openPrsByItem already distinguishes), and make the generator CLI refuse to write the file OR exit non-zero with a loud warning when the scan was unavailable/partial, instead of silently emitting an empty in-review list. Done-when: a fixture where openPrsByItem returns {unavailable: true} (and a second where it returns a partial result) drives we:scripts/gen-decision-docket.mjs's data step, and either (a) it refuses to write we:reports/decision-docket-data.json and exits non-zero, or (b) it writes the file but stamps prScanOk:false/prScanStatus reflecting the failure so a downstream consumer or CI check can assert on it — which of (a)/(b) to pick is left open for the eventual builder to decide.

## Done when

1. **Executable** — A fixture/unit test drives we:scripts/gen-decision-docket.mjs's `data` step with `openPrsByItem` (we:scripts/lib/open-pr-items.mjs) stubbed to return `{unavailable: true}`, and a second case stubbed to return a `partial` result. In both cases the test asserts EITHER (a) the process exits non-zero and we:reports/decision-docket-data.json is left unwritten/unchanged, OR (b) the file is written but its top-level `prScanOk`/`prScanStatus` field reflects the failure, distinguishably from a real all-clear — whichever posture the builder picks, applied consistently to both the `unavailable` and `partial` cases. The healthy-scan case (both stubbed `true`) still writes a file with no failure marker. `node --test <the new test file>` is green, and running the real CLI with `gh` made to fail no longer produces a silently "healthy" we:reports/decision-docket-data.json with `inReview:0`.
