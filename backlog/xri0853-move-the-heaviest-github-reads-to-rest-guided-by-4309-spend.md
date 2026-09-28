---
kind: story
size: 5
priority: high
status: open
blockedBy: ["4309"]
scope: ["we:scripts/lib/gh-spend.mjs", "we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/review-label-provider.mjs", "we:scripts/conveyor/pr-watch.mjs", "we:scripts/conveyor/ci-queue-watch.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/wait-green.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Move the heaviest GitHub reads to REST, guided by #4309 spend data

Once #4309 attributes GraphQL spend per caller and op (`we:scripts/lib/gh-spend.mjs report --by=caller+op`), use that report to move the highest-cost, highest-volume GraphQL reads onto REST calls instead — REST and GraphQL are billed against separate primary buckets, so the same read done via REST spends none of the GraphQL budget the 2026-09-27 incident exhausted. This is a data-guided follow-up, not a guess: it waits for a few busy hours of #4309's real numbers before picking which callers to convert, rather than assuming today.

## Why this is blocked by #4309, concretely

`we:scripts/lib/gh-throttle.mjs`'s own module header already names the suspects from the 2026-09-27 incident's manual forensics: `we:scripts/conveyor/parked-pr-conflict-watch.mjs#computeConflictDisposition` (a `gh api --method GET` PR-state read, confirmed non-mutating by `classifyGhWrite`), plus the daemon watchers that poll PR state on a fixed interval — `we:scripts/conveyor/pr-watch.mjs`, `we:scripts/conveyor/ci-queue-watch.mjs` (already wired to `execFileSyncThrottled`, the shared throttle's own default `exec`), and `we:scripts/wait-green.mjs`. Each of these polls the same handful of fields (state, labels, CI status, head sha) over and over per PR — exactly the read shape `gh api repos/<repo>/pulls/<n>` (REST) answers as cheaply as `gh pr view --json ...` (GraphQL) does, per GitHub's own docs. But "the suspects" is not the same as "the actual top spenders" — #4309's per-caller, per-op attributed-points report is what turns a plausible guess into a ranked, evidenced list, and this card's own Done-when is written against that report's real numbers, not the suspect list above.

## Scope

- `we:scripts/lib/gh-spend.mjs` — read-only consumer of its `report --by=caller+op` output; no changes expected here unless the report needs a new grouping this card discovers it needs.
- `we:scripts/lib/gh-throttle.mjs` — `runGhSync`/`runGhCliPassthrough` already handle both REST and GraphQL calls identically (the throttle classifies by resource, `classifyGhResource`, not by which `gh` subcommand is used), so no throttle-side change is expected; a caller switching from a GraphQL-shaped `gh pr view --json ...` to a REST-shaped `gh api repos/<repo>/pulls/<n>` call is a call-site change only.
- `we:scripts/lib/review-label-provider.mjs` (`GH_ARGV.readPrState`/`readLabels`, `pr view --json ...`) — a candidate conversion target if the spend data ranks it high; today's argv is GraphQL-shaped.
- `we:scripts/conveyor/pr-watch.mjs`, `we:scripts/conveyor/ci-queue-watch.mjs`, `we:scripts/conveyor/parked-pr-conflict-watch.mjs`, `we:scripts/wait-green.mjs` — the daemon-side PR-state pollers named above; each is converted ONLY if #4309's data ranks it among the top spenders, one call site at a time, never a blanket rewrite.

## Risks

- **REST and GraphQL do not return identical shapes.** `gh api repos/<repo>/pulls/<n>` and `gh pr view --json ...` do not serialize fields the same way (field names, nesting, pagination for lists). Every conversion needs its own parser-shape test, not a global find-and-replace of the `gh` invocation.
- **REST has its own primary limit (5000/hr, same account).** Moving load off GraphQL does not create free capacity — it moves the pressure to a bucket that today has far more headroom (per #4309's evidence: "the REST core bucket was nearly untouched" during the incident that exhausted GraphQL), but a large enough migration could someday make REST the new bottleneck. The spend report is the ongoing check for that, not a one-time migration.
- **Picking the wrong target first.** Converting a low-volume caller wastes the slice's effort. The whole point of the `blockedBy` edge is to wait for real ranked data rather than move on the suspects list alone.
- **Behavioural drift during conversion.** A caller that switches its `gh` argv must keep its existing retry/backoff/error-handling contract (`runGhSync`'s thrown-error shape) unchanged; the conversion is a payload change, not a contract change.

## Test plan (each fails before the fix)

1. For each converted call site: a shape-equivalence test asserting the REST-derived value the caller now reads (state, labels, head sha, CI status — whichever fields that caller uses) matches what the old GraphQL-shaped read would have returned, against a fixture pair (fixture captured from both a real REST and a real GraphQL response for the same PR).
2. `we:scripts/lib/gh-spend.mjs`'s own report, before and after: the converted caller's GraphQL request count for its op drops to zero (or near-zero) in `report --by=caller+op`, and its REST request count rises correspondingly — the same op, a different bucket.
3. Existing tests for whichever daemon file is touched (`we:scripts/conveyor/__tests__/pr-watch.test.mjs` / `we:scripts/conveyor/__tests__/ci-queue-watch.test.mjs` / `we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs`, if present — confirmed present or not in the lane at task time) keep passing unchanged in their externally-observable behaviour.

## Tasks

1. Run `we:scripts/lib/gh-spend.mjs report --by=caller+op --hours=<a few busy hours after #4309 lands>`; rank callers by GraphQL points.
2. Pick the top 1-3 callers/ops by points (not just request count — a cheap-per-call, high-volume caller may cost less than an expensive-per-call, low-volume one); confirm each against the suspect list above or a new one the data surfaces.
3. For each: convert its `gh` argv from the GraphQL-shaped call to the REST-shaped equivalent, add the shape-equivalence fixture test (test 1), and verify the spend report shows the shift (test 2).
4. Gate with the `verify` operation; open with `open-pr`; run the proof plan below.

## Proof plan (live, before/after)

- **Before:** `we:scripts/lib/gh-spend.mjs report --hours=24 --by=caller+op` names the converted caller(s) among the top GraphQL spenders, with real attributed/estimated point counts from live headers (#4309's own mechanism).
- **After:** the same report, 24h after the conversion lands, shows that caller's GraphQL points at zero (or near-zero, if it retains any GraphQL-shaped calls) and a corresponding REST request count; the `gh-graphql-budget` health smell's top-spenders list no longer names it; no regression in the caller's own behavioural tests (test 3).

## Done when

1. **Executable** — the shape-equivalence test for each converted call site fails on `main` today (new test, run before conversion — comparing today's GraphQL-only fixture against an unconverted REST call would fail by construction) and passes after conversion; existing daemon tests for touched files pass unchanged; `npm run check:standards` passes.
2. **Observable** — `we:scripts/lib/gh-spend.mjs report --by=caller+op` shows the converted caller/op pair's GraphQL points at (near) zero and its request volume moved to REST, per the proof plan.
