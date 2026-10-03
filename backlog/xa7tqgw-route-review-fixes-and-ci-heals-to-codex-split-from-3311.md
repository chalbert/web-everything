---
kind: story
size: 8
parent: "xv3ce26"
status: open
blockedBy: ["xoopd0u"]
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts.test.mjs", "we:scripts/lib/dispatch-routing-policy.json", "we:scripts/lib/dispatch-routing-policy.mjs", "we:scripts/lib/__tests__/dispatch-routing-policy.test.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs", "we:scripts/operations/__tests__/repair-routing-review-fixes.test.mjs", "we:scripts/conveyor/fix-dispatch-claim.mjs", "we:scripts/conveyor/__tests__/fix-dispatch-claim.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "4a2606bc2f711efd86849e250db36b1b100a0fa4"
tags: [routing, repair]
---

# Route review fixes and CI heals by the same risk tier as review: Codex for ordinary repairs, Claude Opus for critical ones (split from #3311)

Review fixes and CI heals use the review-need tier and critical-work verdict from xoopd0u. Ordinary repairs go to Codex: low effort for inert prose, high otherwise. Critical repairs (gate, statute, security, irreversible, human-required, `risk: high`, or an unreadable card) stay on Claude Opus. The PR #3311 safety boundaries still hold: fail closed on missing cards, a lane-only sandbox, and honest claim release. Existing Claude repair dispatch covers fixes and CI heals until this ships.

## Progress

**Re-aim (2026-10-03).** Old scope: all of `we:scripts/conveyor/`, all of `we:scripts/operations/`, and the policy file. Too wide to build in one job. Old goal: "route fixes and CI heals to Codex". New goal: route them by the same risk logic as review (epic xv3ce26), which still sends ordinary repairs to Codex. The acceptance boundaries from the PR #3311 round-2/3 review are kept as Must lines below. Re-parented from the policy-dimensions epic #4376 to the review-routing epic xv3ce26.

**Grounding.**

- Repairs are carved out of policy routing explicitly: `if (['fix', 'ci-heal'].includes(dispatch.kind)) return record;` (`we:scripts/lib/dispatch-contracts.mjs:1367`, inside `decideDispatchRoute` at line 1352). They keep the legacy evidence/tier router. The policy marks both as `inherit: true` (`we:scripts/lib/dispatch-routing-policy.json:75-76`). The split commit is 89c47f71e ("PR #3311: split — keep the routing core, move fix/CI-heal routing to follow-up xa7tqgw").
- The launch plumbing already honours a policy route. `we:scripts/operations/dispatch-providers/fix.mjs:100-103` and `we:scripts/operations/dispatch-providers/ci-heal.mjs:95-98` pass `--provider`, `--effort` and `--model` from `request.policyRoute` to the delivery wrapper, which knows `codex` (`we:scripts/operations/deliver-item-wrapper.mjs:1306`).
- Repair routes are computed from card data. The tick passes the card's `scope`, `risk` and `tags` (`we:scripts/operations/dispatch-lane-io.mjs:510-520`). The CI-heal PR path passes only `p.scope` (`we:scripts/operations/ci-heal-pr-dispatch.mjs:90`).
- The critical gate already lists `fix` and `ci-heal` (`we:scripts/lib/dispatch-routing-policy.json` `criticalWorkGate.kinds`) and opens `ci-heal`/`bugfix` for non-critical work. `criticalWorkVerdict` (`we:scripts/lib/critical-work.mjs:135`) treats an empty scope as critical. `resolveOperationRoute` keeps only Claude routes when `gateClosed` (`we:scripts/lib/dispatch-routing-policy.mjs:85-95`), but its Claude fallback is Sonnet, not Opus.
- The Codex delivery sandbox is `codex sandbox -P locked` on the lane clone, and `-s workspace-write` was rejected (`we:scripts/operations/codex-delivery-provider.mjs:23-62`). Fix claims are released only by an explicit `releaseFixDispatchClaim` (`we:scripts/conveyor/fix-dispatch-claim.mjs:147`).

## Design

1. **Tier input.** In `decideDispatchRoute`, for `fix` and `ci-heal`, compute `need = reviewNeedFor({ changedFiles: dispatch.scopePaths, tags: dispatch.tags, risk: dispatch.risk })` (xoopd0u). Pass `tier: need.tier` and `gateClosed: need.critical.critical` into `resolveOperationRoute`. This replaces the early return at line 1367.
2. **Policy shape.** Add an optional `riskTiers` block to the policy file and to `validateRoutingPolicy`:

   ```json
   "riskTiers": {
     "fix":     { "haiku": {"provider":"codex","model":"astra","effort":"low"},
                  "sonnet": {"provider":"codex","model":"astra","effort":"high"},
                  "opus":   {"provider":"claude","model":"opus","effort":"high"},
                  "fallback": [{"provider":"claude","model":"sonnet","effort":"high"}] },
     "ci-heal": { same as fix }
   }
   ```

   `resolveOperationRoute({ operation, tier, ... })` uses `policy.riskTiers[operation][tier]` when present, and the existing entry otherwise. Invalid tiers or providers fail validation, and the last good policy is kept (the file's existing `_howTo` rule). When `gateClosed`, the route must be Claude: take the `opus` row, never fall to a non-Claude row.
3. **Fail closed.** An item-less repair (no `num`), a missing or unreadable card, or an empty scope gives `critical` (the `unknown-scope` rule), so it routes to Claude Opus. A sibling repository (Frontier UI, Plateau App) has no critical-work gate of its own yet, so its repairs stay on Claude. A colliding WE card is never read for a sibling repair. `we:scripts/operations/ci-heal-pr-dispatch.mjs` passes the owning card's `tags` and `risk` alongside `scope` (line 90), read from the owning repository's card only.
4. **Claims and launch certainty** (#3311 review boundaries, kept). Release the fix claim on definite pre-launch failures: a refused route, a plain launch error proven not to have started a worker, or ENOENT. Keep and observe the claim on indeterminate launches: a missing PID, an unknown provider error, or a timeout after spawn. Carry the certainty and the original cause through `createDispatchSinks`, so another tick cannot start a duplicate worker. During a native session-listing failure, keep detached-worker claims alive and never release a native claim on an unknown listing.
5. **Sandbox.** The Codex path keeps the locked lane-only sandbox. No broad write grant to the shared fix-claim or completion stores; narrowly scoped protocol writes only.
6. **Pins and records.** A reasoned explicit model override (`deliveryAgent` plus `deliveryAgentReason`) still wins. The run record stores the actual provider, model, effort and `tier` with its reasons.

## MVP

Steps 1-6 in one PR within the scoped files (12 files, 3 areas: `lib`, `operations`, `conveyor`). Delivery is incremental, but production behaviour changes when it lands, because the policy rows go live. The PR therefore lands only after the dry run in the proof plan passes. Blocked only on xoopd0u; it does not touch the #3507 files. Size 8 because of the claim-lifecycle Musts. If the build finds the claim work already done on `main`, it records that and drops step 4.

## Test plan

- (RED today) New `we:scripts/operations/__tests__/repair-routing-review-fixes.test.mjs`, the end-to-end matrix with injected IO:
  - fix and ci-heal × WE, Frontier UI and Plateau App;
  - item-less repairs, missing cards, unreadable cards, and colliding sibling cards;
  - security tag, `risk: high`, low-risk code, card-only prose and statute docs.

  Assert the actual launch argv (`--provider`, `--model`, `--effort`), the stored provider, model, effort and tier, and the claim state across two successive ticks.
- (RED today) `we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs`: the carve-out is gone. Critical repairs route to `claude/opus/high`; ordinary repairs to `codex/astra/high`; prose repairs to `codex/astra/low`. A closed gate (`gateClosed`) never yields Codex and takes the opus row. An explicit reasoned pin wins.
- (RED today) `we:scripts/lib/__tests__/dispatch-routing-policy.test.mjs`: `riskTiers` validates. A bad tier, unknown provider or missing `opus` row is rejected and the last good policy is kept.
- (RED today) `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs`: tags and risk are forwarded. A sibling repository stays Claude.
- (RED today) `we:scripts/conveyor/__tests__/fix-dispatch-claim.test.mjs`: definite failures release the claim; indeterminate launches keep it, with certainty and cause carried through `createDispatchSinks`; an unknown listing never releases a native claim.
- (RED today) **Must on error:** refuse unsafe or unclassifiable repairs before launch, or route them to Claude Opus. Never send them to Codex. No broad shared-store sandbox grant.
- (RED today) **Must for non-code:** apply the same security and risk gate to source, docs, config and data scopes, including missing-card and cross-repository cases. Statute docs (`we:docs/agent/**`, `we:AGENTS.md`) are critical and go to Claude.

## Proof plan

1. Run the five suites. Mutation check: restore the line-1367 early return; the new matrix must fail.
2. Isolated end-to-end dry run from an acquired lane, before the policy rows go live. Feed one real bounced PR's card (ordinary `scripts/` scope) and one critical card (a gate file) through `decideDispatchRoute` and the real `we:scripts/operations/dispatch-providers/fix.mjs` argv builder, with the spawn stubbed. Capture argv and the stored record for each. Then run one real Codex fix on a throwaway lane for the ordinary case and show the claim lifecycle across two ticks. Paste the records here.

## Done when

1. `npx vitest run` on the five scoped suites passes, including `we:scripts/operations/__tests__/repair-routing-review-fixes.test.mjs`, covering every Must above (actual argv, stored model and effort, claim state across ticks).
2. The dry run and the one live Codex fix are recorded on this card.
3. `npm run check:standards` passes.

## Follow-ups

- Union the bounced PR's real changed files (`gh pr view --json files`) into the tier input, so a repair that wanders outside its card scope is still classed correctly. That needs a new read at the IO edge, so it is kept out of this card.
- Give sibling repositories their own critical-work gate before routing their repairs off Claude.
