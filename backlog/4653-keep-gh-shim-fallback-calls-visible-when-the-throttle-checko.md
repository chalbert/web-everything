---
bornAs: xkcp5vc
kind: story
size: 3
status: open
scope: ["we:scripts/lib/gh-app-shim.mjs", "we:scripts/lib/__tests__/gh-app-shim.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Keep gh shim fallback calls visible when the throttle checkout disappears

The host has 162 generated shims whose throttle target is missing. Their direct fallback authenticates with the shared App cache and writes no spend record. Preserve compatibility while capturing sanitized cost and fallback provenance independently of the missing module graph.

## Evidence and fix design

See we:reports/2026-09-30-unmetered-app-graphql-spend.md. The installed shim inventory contains 177 scripts, of which 162 reference missing throttle files. Source we:scripts/lib/gh-app-shim.mjs:321 directly executes the real gh when its throttle target or imports disappear; fresh cached App auth survives while accounting does not. The shared shim target currently exists. No incident-hour fallback count or active use of the stale shims was established; this is a proven latent coverage defect, not a quantified historical spender.

Provide a stable minimal metering transport independent of disposable checkout module graphs. Preserve compatibility fallback, sanitized response-cost/unknown-cost capture, caller and installation provenance, and one execution per command. Regenerate through the shim owner and check adoption without deleting files still referenced by live sessions. This extends the fallback explicitly deferred by #4375.

## Done when

1. Tests remove the throttle entry and a transitive import separately, then prove one underlying gh invocation and a sanitized fallback ledger record for each.
2. Working throttle paths remain byte-compatible and do not double-count nested records. An unrelated command failure never causes replay.
3. A supervised disposable-checkout probe proves fallback observability and active PATH adoption without printing credentials or modifying production credentials.

## Follow-ups

Run we:scripts/lib/__tests__/gh-app-shim.test.mjs and we:scripts/verify-lane.mjs. Measure actual fallback executions separately from stale files. No production fallback was deliberately triggered during this diagnosis. Filed unqueued for review.
