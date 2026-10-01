---
kind: story
locus: plateau-app
size: 3
parent: "4623"
status: open
blockedBy: ["4620", "xr61n39"]
scope: ["plateau-app:src/wip/types.ts", "plateau-app:src/wip/progress-prs.ts", "plateau-app:src/wip/progress-prs.test.ts", "plateau-app:src/wip/progress-read.ts", "plateau-app:src/wip/progress-read.test.ts", "plateau-app:src/wip/wip-read.ts", "plateau-app:src/wip/wip-read.test.ts", "plateau-app:src/wip/wip-model.ts", "plateau-app:src/wip/wip-model.test.ts"]
dateOpened: "2026-10-01"
tags: []
---

# Collect and classify every cached PR across the three Plateau repos

Replace the single-repo open-PR fetch with a passive repo-and-number collection shared by the progress collector. Preserve every author and cardless PR, classify head-bound waits, and deduplicate explicit human actions with honest coverage.

## Design

Build the proposed PR adapter behind #4620's collector, shared by publisher and dev API. Read exactly the configured three repo stores via the owning resolver. Retain all rows, including operator branches, cardless PRs, unknown authors, multiple PRs for one card and duplicate numbers in different repos. Validate repo identity, fields, timestamp, count, limit and truncation beyond the store's minimal JSON guard. Preserve the last good observation with its original age on failure. Dirty markers invalidate freshness. A fresh publish never refreshes producer evidence.

The display precedence is explicit human disposition → draft author continuation → confirmed conflict → active/owed fix or ci-heal → pending/unknown CI → owed/active review → ready for drain → unknown, retaining every reason (we:docs/agent/plateau-progress-view.md, Classification section). CI/review must attest to the current head; labels alone do not certify acceptance. Do not infer merge readiness from missing CI, absence of a handler or an old green advisory. Unknown enum codes remain visible. Human-review rows retain system prerequisites and count once as pending human work, becoming actionable only when prerequisites are met. Keep existing fork links. This projection does not authorize approval, dispatch or merge.

Define the collection, waiting-chain and page wire type projections from the predecessor contract in we:../plateau-app/src/wip/types.ts so both successor branches reuse one interface. Create the proposed passive adapter at we:../plateau-app/src/wip/progress-prs.ts and extend the existing progress reader/model boundary. Initialize unavailable waiting-chain fields with explicit reasons under the new contract; this slice does not pretend local chain enrichment exists. Retain the accepted full collection locally for the transport successor. Until bounded paging is installed, keep large collections out of published payloads and expose truthful summary/actions; no over-limit push or completeness claim from a clipped preview. Consumer/relay acceptance must precede enabling new wire fields.

## Observed seam and scope

we:../plateau-app/src/wip/progress-read.ts:66 defines injectable passive store IO and :70 currently returns only a count. we:../plateau-app/src/wip/wip-read.ts:409 still invokes one-repo `readPrs`, while :445 separately reads the three persisted caches. Replace this flow's open-PR fetch with one shared passive collection, retaining unrelated merged-history activity as separately attributed work. we:../plateau-app/src/wip/wip-model.ts:152 collapses card-linked PRs by severity; :359 projects cached summary data. Add repo/number rows independently of that legacy card projection and derive explicit human counts without duplicates. Wire types at we:../plateau-app/src/wip/types.ts:264 carry schema-2 coverage.

The passive owner at we:scripts/lib/pr-snapshot-store.mjs:42 supplies the resolver; :78 supplies dirty-marker observation. These are read-only dependencies, not edit scope. Reconcile #4620 before build even though schema-2 code is now present in the sibling checkout; the card remains open.

Budget: **9 implementation/test paths, 1 area** (we:../plateau-app/src/wip/), plus the card close-out. New adapter and its test are proposed; adjacent tests and all other files already exist. Exact touch set is frontmatter scope.

## Test plan / Done when


- **Capability — Red today expected (not executed during this backlog split):** Adapter, progress reader, collector and model tests prove exact membership for operator/cardless PRs, two PRs per card, same number in all three repos and unknown authors. Assert primary groups sum to included unique PRs, independent of epic/author filters.
- **Capability — Red today expected (not executed during this backlog split):** Cover corrupt/missing/stale/dirty/truncated caches, inconsistent repo/count/limit/fields/timestamps, one failing repo and last-good retention with unchanged age. No false zero and no fabricated universe total.
- **Capability — Red today expected (not executed during this backlog split):** Exercise every classification precedence boundary, draft plus red CI, human review plus failed CI/advisory, unknown labels, absent handler, stale-head CI/review and duplicate actions. Pending human work counts once and becomes actionable only after prerequisites pass; forks remain unchanged.
- **Capability — Red today expected (not executed during this backlog split):** Process/network spies prove no open-PR `gh` fetch or refresh-on-miss accessor. Replay fixture stores through the real collector and compare the exact repo/number manifest and existing summary/actions projection. This yields a usable passive summary and testable collection before the new UI; full publisher/browser proof belongs to the final slice.

## Delivery boundary

This is one story under #4623; its prepared Design, MVP and Proof plan remain the umbrella acceptance. No implementation was performed while splitting. Reconcile predecessor interfaces before build and capture expected failing capabilities before changing code. All tests use sanitized fixtures, injected clock/IO and network/process spies, never live claims. A missing source means unknown with a reason. No new GitHub polling, approval, dispatch or merge behavior is authorized.

Build only the listed scope. Re-probe the touch set if upstream interfaces move; split again before exceeding 20 paths or 4 areas. Run the affected suites and the owning repository gate, recording commands, source identities and limitations on this card. Keep testing lessons in Follow-ups rather than shared agent docs.
