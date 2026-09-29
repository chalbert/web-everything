---
bornAs: xejvuqt
kind: task
parent: "4108"
status: open
blockedBy: ["4108"]
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Add an integration test proving the RECONCILE context reuses the #4108 candidate listing's raw, base- and label-UNFILTERED rows

#4108's fix reuses the merge-candidate listing's raw rows for the RECONCILE-gated open-PR context instead of a second gh pr list. Its own dedupe tests only assert gh-pr-list call counts and the label/base candidate-set filter; nothing exercises the couple gate's carrier-visibility path to prove a cross-base or unlabelled carrier PR is genuinely still visible to the reused context (openPrContext.prsByRepo / openItems). Build an integration test that sets up a couple (a manifest-carrying carrier PR on a non-default base, or unlabelled) and asserts the context still sees it — i.e. the couple gate does not treat it as landed. Surfaced by the #4108 converge panel (security/standards-conformance/claim-accuracy lenses, round 1 v2) as a real but parallelizable gap, not a blocker to #4108 itself.

## Done when

1. **Executable** — a new test in `we:scripts/__tests__/` drives a couple (a `we:.lane-manifest.json`-carrying
   carrier PR on a non-default base, or unlabelled) through `collectOpenPrContext`/`joinImplToCouples` (or the
   full CLI, via the fake-`gh` shim pattern in `we:scripts/__tests__/merge-ai-prs-listing-dedupe.test.mjs`) and
   asserts the coupled impl PR DEFERS (never orphan-lands) while the carrier stays visible — i.e.
   `openPrContext.openItems` (or the couple gate's `held`/`deferred` verdict) still names the carrier's item,
   whether the carrier is unlabelled or on a base the candidate sweep's `--base` filter excludes. Running the
   NEW test file directly (`node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run <the new test
   file>` — no `--passWithNoTests`, deliberately: that flag would make "no such file" a silent pass) fails
   before the test exists (no such file — vitest errors, non-zero exit) and passes once it is added and green.
