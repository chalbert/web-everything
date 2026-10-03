---
bornAs: xrxb9uc
kind: story
locus: plateau-app
size: 5
parent: "4623"
status: open
blockedBy: ["4893"]
scope: ["plateau-app:src/wip/progress-pages.ts", "plateau-app:src/wip/progress-pages.test.ts", "plateau-app:src/wip/wip-source.ts", "plateau-app:src/wip/wip-source.test.ts", "plateau-app:src/wip/wip-live.ts", "plateau-app:src/wip/wip-live.test.ts", "plateau-app:src/wip/wip-api.ts", "plateau-app:src/wip/wip-api.test.ts", "plateau-app:src/wip/wip-publish.ts", "plateau-app:src/wip/wip-publish.test.ts", "plateau-app:src/wip/wip-agent.test.ts", "plateau-app:src/wip/wip-relay-contract.test.ts", "plateau-app:scripts/wip-publish.ts", "plateau-app:wip-relay.js", "plateau-app:scripts/wip-relay.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Serve snapshot-bound cached PR pages through the Plateau relay

Deliver bounded read-only PR pages from the accepted snapshot through publisher, authenticated relay and dev API. Reject hostile or expired cursors, preserve schema fallback and ordering, and ensure extra tabs and page requests never refresh collection or invoke commands.

## Design

Keep #4620's 120-second collector and authenticated relay. Existing wiring is at we:../plateau-app/scripts/wip-publish.ts:73,97,104; relay payload cap and ask allowlist are at we:../plateau-app/wip-relay.js:19,287,357. Add a bounded read-only PR-page ask to that allowlist and publisher handlers, backed solely by the accepted collection. Request includes snapshot identity and opaque cursor; response includes the same identity, coverage, totals and next cursor. Bound page bytes below the relay cap. Expired snapshots return an explicit restart response; never union pages from different snapshots. Paging/offline failure preserves displayed rows and marks the remainder unreachable rather than complete. Extra tabs and page asks perform no collection refresh or agent invocation.

Provide a bounded cache/page helper at we:../plateau-app/src/wip/progress-pages.ts shared by publisher and dev API. Cache only the collection from an accepted snapshot; distinguish full local membership from a wire page's included count. Dev page requests must branch before the ordinary snapshot cache miss path, so expired/corrupt/hostile cursors cannot trigger `read`. Keep HTTP fallback and WebSocket output coherent. Validate new fields in relay/source consumers before enabling publisher output; schema-1 and absent-collection schema-2 snapshots remain accepted as unavailable.

The waiting-chain sibling is not a prerequisite: transport must round-trip both explicit unknown chains and contract fixtures with full chains. Keep transport independent of producer parsers. Extra tabs/page asks cannot collect, dispatch or call an agent. Existing authentication, size caps and ask allowlist remain enforced.

## Observed seam and scope

we:../plateau-app/scripts/wip-publish.ts:56 owns `read`, :105 wires the agent and :117 supplies the read-only asks table. we:../plateau-app/src/wip/wip-api.ts:39 owns the single cached dev snapshot; we:../plateau-app/src/wip/wip-source.ts:42 accepts schema 1/2 via relay validation; we:../plateau-app/src/wip/wip-live.ts:34 parses snapshots and ask results. The relay bounds answer shape/bytes at we:../plateau-app/wip-relay.js:462 and :676, and preserves sequence order at :562. we:../plateau-app/src/wip/wip-agent.ts:78 already injects ask handlers, so test that seam without changing its command engine.

Budget: **15 implementation/test paths, 3 areas** (we:../plateau-app/src/wip/, we:../plateau-app/scripts/, and root relay we:../plateau-app/wip-relay.js), plus at most one card close-out path/area = **16 paths / 4 areas**. Page helper/test are new; other scope files exist. Exact touch set is frontmatter scope. Do not widen into unrelated routing/agent behavior.

## Test plan / Done when

- **Capability — Red today expected (not executed during this backlog split):** Run affected source/live/API/publisher/agent/relay-contract tests and we:../plateau-app/scripts/wip-relay.test.mjs. Cover schema-1 fallback, unchanged schema 2, new-field round trip, unknown-version rejection, old sequence, new boot/reconnect and oversize bodies.
- **Capability — Red today expected (not executed during this backlog split):** Prove snapshot-bound page union exactly equals the fixture manifest without duplicates. Reject stale/hostile cursor, cross-snapshot page, invalid identity and offline publisher with explicit restart/unreachable results; retain accepted rows on failure.
- **Capability — Red today expected (not executed during this backlog split):** Run page requests from two simulated clients and assert unchanged collector-read count, no commands/refresh/API spending, bounded bytes/depth/arrays and finite cache retention. Test Unicode byte lengths against the actual relay cap.
- **Capability — Red today expected (not executed during this backlog split):** Exercise real publisher → relay requests with sanitized multi-repo fixtures and a second client before enabling new output. Existing UI remains usable during rollout; terminal page inspection demonstrates all cached rows independently of the future Flow renderer. Keep 120-second cadence and attribute unrelated legacy history activity separately.

## Delivery boundary

This is one story under #4623; its prepared Design, MVP and Proof plan remain the umbrella acceptance. No implementation was performed while splitting. Reconcile predecessor interfaces before build and capture expected failing capabilities before changing code. All tests use sanitized fixtures, injected clock/IO and network/process spies, never live claims. A missing source means unknown with a reason. No new GitHub polling, approval, dispatch or merge behavior is authorized.

Build only the listed scope. Re-probe the touch set if upstream interfaces move; split again before exceeding 20 paths or 4 areas. Run the affected suites and the owning repository gate, recording commands, source identities and limitations on this card. Keep testing lessons in Follow-ups rather than shared agent docs.
