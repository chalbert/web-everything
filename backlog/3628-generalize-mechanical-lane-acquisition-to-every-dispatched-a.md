---
bornAs: xf3djp7
kind: decision
parent: "3383"
status: open
relatedTo: ["3627", "2630", "2275", "3369", "3580", "3629"]
dateOpened: "2026-09-08"
tags: [conveyor, dispatch, lane-pool, mechanical-delivery-doctrine]
---

# Generalize mechanical lane acquisition to every dispatched agent type, not just build (downstream of #3627)

NOT YET DECIDED — record-only, matching the posture of we:backlog/3627 and the other deferred decision items filed the same period. Operator's generalization (tonight, on top of we:backlog/3627's build-agent-specific wrapper design): lane acquisition (and, by extension, release) should be MECHANICAL for every dispatched agent type — build, fix, review, prepare — driven by a wrapper that spawns the agent, never something the dispatched agent does to itself. Concrete evidence checked before filing, not asserted: (1) BUILD agents self-acquire today — we:skills-src/conveyor/delivery-agent-brief.md step 1 has the agent itself run `we:scripts/lane-pool.mjs acquire --scope=...`, and we:scripts/operations/dispatch-lane.mjs's own header (line ~255) confirms "the brief tells the agent to run we:lane-pool.mjs acquire ... --scope={{SCOPE}}" as the current live design. (2) REVIEW agents self-acquire today, the SAME shape — we:skills-src/review/review-agent-brief.md step 1 has the agent itself run `node we:scripts/lane-pool.mjs acquire --purpose=review-loop --session={{SESSION_SLUG}} --wait-ms=30000 --adopt`, and we:scripts/operations/review-dispatch.mjs's own header states the design choice explicitly and in so many words: "It does not acquire a lane (the dispatched session acquires its own, per the brief's own first step — this operation would otherwise be leasing a resource whose release it cannot guarantee, the same reasoning we:dispatch-lane.mjs's own header gives for never acquiring on a delivery agent's behalf)." (3) FIX agents also self-acquire today — we:skills-src/conveyor/fix-agent-brief.md step 1 has the agent itself run `node we:scripts/lane-pool.mjs acquire --lane={{LANE}} --purpose=conveyor-fix --session={{SESSION_SLUG}} --scope={{SCOPE}} --base={{LANE_REF}}`. Three of three dispatched-agent briefs checked share the identical anti-pattern: the mechanical dispatcher hands the agent a brief that tells IT to run the acquire, rather than the dispatcher (or a wrapper around it) acquiring first and handing the agent an already-live working directory.

What already exists, checked before filing rather than assumed: we:backlog/3627-dispatched-delivery-agents-should-get-a-minimal-hand-crafted.md's 2026-09-09 amendment (open PR #2104, `lane/3627-minimal-delivery-brief-design`, not yet merged/ratified) already prototypes exactly this move for ONE agent type. Its design-sketch we:scripts/operations/deliver-item-wrapper.mjs has the WRAPPER (not the agent) call `acquireLane`, spawn the new minimal brief (we:skills-src/conveyor/delivery-agent-brief-v2.md) in the FOREGROUND — no `--bg` — so the wrapper's own blocking spawn call is the completion signal (true push, zero polling, per that amendment's requirement 4), and only the wrapper calls release. This is genuinely the same shape the operator is generalizing tonight. But it is NOT already general: every other function in that sketch (`claimItem`, `runGateWithOneRetry`, `runConverge`, `decideParkMode`, `openPr`, `dropLearning`) is build-specific machinery with no review or fix analogue, and neither the sketch, its wrapper file, nor #3627's card body mentions review or fix dispatch anywhere. Extending the pattern to we:review-dispatch.mjs and the fix-agent brief is a genuinely separate design exercise on top of #3627's prototype, not something already covered by it.

A real, unresolved tension this generalization needs to answer, not just extend: we:review-dispatch.mjs's own header states the ORIGINAL reason review agents self-acquire is that a wrapper-side acquire on the agent's behalf would be "leasing a resource whose release it cannot guarantee" (the wrapper cannot promise the spawned agent will ever hand the lease back). #3627's prototype answers this for build by making the spawn foreground/blocking, so the wrapper's own process never loses control of the lease it took out — but that answer has not been checked against we:review-dispatch.mjs's `claude --bg` spawn (review dispatch is deliberately backgrounded and unwatched — "nobody is watching this session turn by turn", the brief's own words) or against the fix-agent brief's cross-session reconstitute-by-ref flow. Whether the same foreground-blocking trick even applies to a backgrounded, fire-and-forget review dispatch is a real open question for whoever picks this up, not a solved detail.

Checked and ruled out as already covering this, so this is genuinely new scope: we:backlog/2275-generalize-the-lane-pool-into-a-use-agnostic-leased-checkout.md (resolved) made the lane-pool ALLOCATOR itself use-agnostic — any consumer (drain, merge, prepare, decision, batch, solo) can acquire/release the SAME primitive instead of hand-rolling a bespoke clone. That is a different axis entirely from this proposal: #2275 is about the allocator serving any CONSUMER TYPE; this proposal is about WHO ISSUES THE ACQUIRE CALL for one consumer (a dispatched agent calling it on itself vs. a wrapper calling it on the agent's behalf, mechanically, before the agent ever starts). #2275's own text and slices never raise or anticipate the wrapper-drives-acquisition question. we:backlog/3369-decouple-agent-dispatch-from-the-claude-cli-introduce-a-mult.md and we:backlog/3580-decouple-the-delivery-agent-dispatcher-from-the-claude-cli-s.md (both open) are also a different axis — decoupling the dispatcher from the Claude CLI SPECIFICALLY (which binary gets spawned, multi-provider), not who calls we:lane-pool.mjs or when. Neither anticipates this generalization. we:scripts/capability-search.mjs run before filing (verdict: partial — found #3627 and #2275 as the two nearest neighbors, neither an exact match) confirms no existing item already states "generalize mechanical lane acquisition to every dispatched agent type."

Explicit sequencing, per the operator's own framing tonight: this is downstream of #3627, a generalization to CONSIDER once the wrapper pattern is proven for build (one agent type), not a call to redesign build/review/fix/prepare dispatch all at once. NOT YET DECIDED — record only, no ratification, no build should start from this card until it is prepared and ratified, same posture #3627 itself uses for its own amendment.

## Amendment (2026-09-09) — this item's own open question, partially answered by a sibling design pass

we:backlog/3629-review-and-fix-dispatch-should-get-the-same-minimal-context.md (filed same day, downstream
of #3627, now that #3627's own wrapper was proven live end-to-end against real item #3371 — see
we:docs/agent/prototype-based-dev.md) is a full minimal-context/wrapper design pass specifically for review and
fix dispatch, not just the narrower "who calls we:scripts/lane-pool.mjs acquire" slice this card scopes itself
to. It bears directly on this card's own still-open question above ("whether the same foreground-blocking trick
even applies to a backgrounded, fire-and-forget review dispatch"): that item's finding is that a review
dispatch may not need a live Claude session in the critical path AT ALL — we:scripts/operations/review-loop-cli.mjs
already prints a structured verdict and already runs its own independent jurors, and the identity check
we:scripts/lib/review-independence.mjs's self-clear refusal keys on (`CLAUDE_CODE_SESSION_ID`) is an env var any
process can set, not something that requires a live agent turn to satisfy. If that holds up under the empirical
verification that item itself flags as still owed (mirroring #3627's own "never assert a CLI-flag interaction
without running it for real" discipline), this card's own foreground-vs-background tension dissolves for
review specifically — there is no backgrounded agent spawn left to make foreground, because there is no agent
spawn in the review-dispatch wrapper's own critical path at all. It remains fully open for FIX, which performs
real code-editing judgment (unlike review) and should inherit #3627's proven never-`--bg`, foreground-blocking
pattern directly, mirroring we:scripts/operations/deliver-item-wrapper.mjs's own `CLAUDE_RESTRICTED_PROVIDER`.
Record only — this amendment does not ratify either card; both stay NOT YET DECIDED.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
