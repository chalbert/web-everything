---
bornAs: x2vf12v
kind: story
size: 3
parent: "3717"
status: resolved
blockedBy: ["3845"]
scope: ["we:scripts/operations/review-dispatch.mjs", "we:scripts/operations/__tests__/review-dispatch.test.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/dispatch-task-type.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
graduatedTo: none
tags: []
---

# Fork 3 of #3801, review: review-dispatch becomes a router caller, one review-lens subject per seat, with capability as the entry gate

Ruled in #3801 Fork 3 (c): review-dispatch becomes a router caller, as #3717 step 2 named. we:scripts/operations/review-dispatch.mjs today takes judgeProvider from a flag with a claude default (:441) and never consults the router. It routes each seat on its lens subject; a provider is a candidate for a tool-bearing seat only if it can be held to the declared-operations surface (#reviewer-tool-surface-and-containment clauses 1 and 2), so the existing Codex refusal for tool-bearing seats (CODEX_JUDGE_PROVIDER_REFUSAL, :532, #3581) becomes the first capability rule. With no graduated review-subject trials every seat resolves to Claude, so behaviour is unchanged.

**Home:** the prototype branch `lane/mechanical-dispatcher`. `we:scripts/operations/review-dispatch.mjs` also exists on `main`; the change is made to the branch copy, which is the one that can import `we:scripts/lib/dispatch-contracts.mjs` (branch only). Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**Order:** `blockedBy` the Fork 3 core slice (the subject axis this routes on).

**Scope of the change, stated.** One `judgeProvider` today sets the provider for every seat of the review run. This slice computes and records a route per mandatory seat lens, and passes a non-Claude provider only when every seat's route names it; otherwise Claude. The seat's evidence bar is the labelled replay corpus and #3675's replay parity gate (#3801 Fork 3); that gate is #3675's work, not this slice's. The explicit `--judge-provider` flag is left as it is and recorded beside the route, never over it.

## Done when

1. **Executable** — on the branch, `grep -nE "decideDispatchRoute|routeDispatch" we:scripts/operations/review-dispatch.mjs` prints at least one import and one call (today it prints nothing).
2. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-dispatch.test.mjs` passes with new cases that fail before: (a) with empty scorecards, the dispatch result carries a `routing` record per mandatory seat, each with a lens subject and provider `claude`; (b) with scorecards that would graduate `codex` on a lens, a tool-bearing seat still resolves to `claude`, with the capability reason in its audit trail; (c) a run with `--judge-provider` records both the route and the flag's value.

> **Verified done, 2026-09-22.** Already built and committed straight to `lane/mechanical-dispatcher` at
> `15d003432` ("#3846 fork 3 of #3801, review: review-dispatch becomes a router caller"), ahead of this card
> being picked up. Re-verified: `we:scripts/operations/review-dispatch.mjs` imports and calls
> `decideDispatchRoute`, and `we:scripts/operations/__tests__/review-dispatch.test.mjs` passes (59 tests) with
> the `reviewSeatRoutes (#3846)` cases present, including the tool-bearing-seat capability-gate case. Resolved
> here as `graduatedTo: none` — the code is not yet on `main`; it reaches `main` through #3443, per this
> card's own `Home:` section.
