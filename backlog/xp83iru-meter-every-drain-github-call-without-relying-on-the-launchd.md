---
kind: story
size: 5
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs"]
dateOpened: "2026-09-30"
tags: []
relatedReport: reports/2026-09-30-unmetered-app-graphql-spend.md
---

# Meter every drain GitHub call without relying on the launchd PATH

The resident drain refreshes the App token but bypasses the throttle on synchronous and asynchronous gh calls. PR #3103 CI-heal commit 3dabd061b removed its synchronous adapter; restore coverage with a soak-safe transport and prove ledger capture under the real launchd PATH.

## Evidence and fix design

The incident report is we:reports/2026-09-30-unmetered-app-graphql-spend.md. The live drain sets the App token but launches raw gh under a launchd PATH without the shim. we:scripts/merge-ai-prs.mjs:129 imports both synchronous and asynchronous raw executors; discovery at :4130 and commit reads at :3832 bypass the meter. CI-heal commit 3dabd061b explicitly reverted synchronous coverage before PR #3103 merged. The exact incident hour contains 44 drain passes, including 42 successful passes and 12 merges; the total cost remains unmeasured.

Restore synchronous coverage and add a metered asynchronous transport while retaining bounded concurrency, return/error fidelity, and one ledger event per attempt. Audit descendant utilities and lifecycle raw reads at we:scripts/lib/daemon-edge.mjs:574 and we:scripts/lib/daemon-rebuild.mjs:897; their current empty registries do not establish historical usage. Broaden scope only for independently confirmed reachable paths.

## Done when

1. A transport test invokes both discovery and synchronous guard reads with a launchd-equivalent PATH that contains only the real gh fixture; both reach the meter once and preserve their outputs and failures.
2. The drain soak that timed out during PR #3103 passes with an isolated admission root and realistic concurrency. No coverage adapter is removed to make it pass.
3. An observed production pass records drain attempts, installation provenance, costs or explicit unknown costs, and reset data. Compare matched intervals without claiming that attribution alone reduces consumption.

## Follow-ups

Run the affected transport and drain soak suites and we:scripts/verify-lane.mjs. Keep regression lessons here; do not modify shared agent documentation. Obtain authenticated Actions run counts in a network-enabled follow-up; current source uses built-in workflow tokens, so run actor alone cannot establish App-bucket spend. This card is filed unqueued for human review; no runtime fix was made by the diagnosis.
