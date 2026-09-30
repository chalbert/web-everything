---
bornAs: xp83iru
kind: story
size: 5
tier: pinned
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

## Progress

2026-09-30 — investigation in lane-43; implementation and required proof remain incomplete.

- Confirmed `3dabd061b` removes only the synchronous throttle import from we:scripts/merge-ai-prs.mjs. Temporarily restored that adapter to attempt the pre-fix reproduction; removed the diagnostic edit afterwards because no drain tick reached execution. This is not a fix or an attribution claim.
- Baseline: `npx vitest run we:scripts/lib/__tests__/gh-throttle.test.mjs` (strip the `we:` prefix when executing locally) passed all **81 tests** in **635 ms**.
- Before-proof attempt: the normal couple-split drain soak, we:scripts/conveyor/soak/breaks/couple-split-by-unrelated-merge.soak.test.mjs, failed before tick 1 with `ENOTEMPTY` deleting a temporary Git fixture. Repeating with a different temporary root produced the same failure. The stale-label soak, we:scripts/conveyor/soak/breaks/ci-heal-loop-stale-label-review-gate.soak.test.mjs, reported an expected-failure pass despite the same setup crash: **zero ticks is not drain proof**.
- A diagnostic-only preload retained temporary template repositories instead of deleting them; setup then failed cloning the simulator repository with `fatal: unable to read tree`. No tick bounds, assertions, repository tests, or gates were edited. Neither diagnostic run reproduces the historical 90-second timeout; its cause remains unproven.
- Transport audit: discovery, manifest API reads, per-PR commits and default-branch reads use the raw async executor. Synchronous guards and mutations use the raw sync executor. In addition, the drain calls `mergePr` and `retargetStackedPrs` without supplying their injectable executor; both default to raw GitHub calls in we:scripts/lib/pr-merge-gate.mjs. A complete transport change must inject the metered executor there too. The raw lifecycle reads in we:scripts/lib/daemon-edge.mjs and we:scripts/lib/daemon-rebuild.mjs were confirmed in source, but no executing drain path to them was established; no scope expansion was made.
- Production-proof attempt: a read-only authenticated `gh api graphql` rate-limit query failed with `error connecting to api.github.com`. No production pass, installation-labelled cost/reset observation, or matched before/after interval was obtained.
- Required verification: `node we:scripts/verify-lane.mjs` (local execution without `we:`) selected **56 targets** for the temporary adapter change, then exited **1** before running them: `EPERM` writing its marker under we:.git/.lane-verify.*.tmp. This checkout's configured filesystem permissions make we:.git read-only. The marker gate was not bypassed.

- Final card-only verification again failed at the read-only marker write. `npm run check:standards` initially failed creating the host admission directory; rerunning with an isolated temporary `LANE_POOL_ROOT` passed with **0 errors and 4,520 warnings**. `git diff --check` passed.

No runtime change is retained. Keep this card open: the soak timeout reproduction, soak-safe synchronous/asynchronous transport, regression test, successful lane verification and production before/after proof are still owed. Resume in an environment where the normal Git-fixture soak, verification marker write and authenticated production observation can run.
