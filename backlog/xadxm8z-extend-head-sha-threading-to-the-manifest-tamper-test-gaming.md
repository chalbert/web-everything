---
kind: task
parent: "2502"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/gate-entrypoint-integration.test.mjs", "we:scripts/__tests__/merge-ai-prs-couple-join-and-drain-verdicts.test.mjs"]
dateOpened: "2026-09-08"
tags: []
---

# Cover the manifest-tamper/test-gaming park headSha stamps with a test, and extend headSha to the rebased/pendingRebased/healed buckets

#2502 stamped `v.headSha`/`c.headSha` onto toMerge/merged/skipped/parked/deferred/failed — the exact six buckets its own spec named — with real integration+pure test coverage for most of them (including a live, non-dry-run merge and merge-failure test for merged/failedMerges). Two gaps remain, both flagged by #2502's own converge review as carve-outs (not blockers — neither makes the sweep worse than its pre-#2502 base): (1) the manifest-tamper re-park (~L3963) and anti-test-gaming park (~L4013) push sites in we:scripts/merge-ai-prs.mjs DO already carry `headSha: v.headSha` (added in #2502 itself, alongside the third `parked.push` site at ~L4279 which the #2502 integration suite DOES cover) — but no test exercises either of those two specific paths, so nothing would catch a future edit silently dropping the field there; (2) the rebased/pendingRebased/healed buckets (a PR whose tip gets rebuilt to drop a stale lane-manifest, #2198) never got a headSha field at all, despite being exactly the 'tip changed mid-sweep' case the churn detector (#2487 follow-on) cares about most.

Edge cases the next build must cover: an integration test that actually TRIGGERS the manifest-tamper and test-gaming detection paths (baseline-mismatch / test-gaming fixtures) and asserts each resulting `parked[]` entry carries `headSha` matching the PR's tip commit, not the first commit of a multi-commit read (per #2502's own correctness-review finding on `commits[length-1]` vs `commits[0]`); a rebased PR whose rebuild changes its head SHA, asserting the NEW post-rebuild SHA lands in `rebased`/`pendingRebased`/`healed`, not the pre-rebuild one — a hand-built verdict object under-proves this, per #2502's own converge finding that object identity through the real `runCli` cascade is what actually needs proving; the SAME class of gap applies to the `deferred` bucket (proven today only against a hand-built candidate object in we:scripts/__tests__/merge-ai-prs-couple-join-and-drain-verdicts.test.mjs, never through the real buildDrainVerdicts → joinImplToCouples → planLabelDrain pipeline) — add a real-entrypoint test driving a genuinely blocked/deferred PR through we:scripts/__tests__/gate-entrypoint-integration.test.mjs asserting `result.deferred[].headSha`, alongside the tamper/gaming/rebased work above.

## Done when

1. **Executable** — a new test in we:scripts/__tests__/gate-entrypoint-integration.test.mjs drives the real `runCli` through a manifest-tamper (or test-gaming) fixture and asserts the resulting `parked[]` entry's `headSha` equals the PR's tip commit oid; today no such test exists, so this command currently has nothing to fail against (write it FIRST, confirm it fails without the fix, per the standing invariant) — then land `rebased`/`pendingRebased`/`healed` headSha threading with its own asserting test.
