---
kind: epic
size: 13
status: open
dateOpened: "2026-08-08"
tags: [conveyor, cost, review, orchestration]
---

# Move agent work onto the Claude Code CLI and optimise what it costs

The product direction is a UI-driven app invoking the CLI, so session-spawned subagents become CLI invocations. One day's sample HINTS that cache-prefix stability beats a bespoke prompt by ~20x — a hypothesis to re-measure, not a finding. Needs current research on request optimisation, a cost baseline, and a sweep of which subagent calls and procedural steps move off the model.

## Why now, and why it is not optional

The stated direction is a **UI-driven application** that drives work by invoking the Claude Code **CLI** first, and the Claude Code **API** later. Both eventually; the CLI is what gets built first. So the question is not *whether* to move agent work out of a chat session — that is already the destination — it is how to arrive there cheaply rather than arriving and then discovering the bill.

A second forcing function is **coming, not yet in force**. #2844 (open, filed 2026-08-02) specifies a land seam that refuses a verdict cleared by its own author; its implementation is PR #1100, which is open and awaiting a human clear. Nothing in `we:scripts/review-set-label.mjs`, `we:scripts/lib/review-escalation.mjs`, `we:scripts/merge-ai-prs.mjs` or `we:scripts/pr-land.mjs` compares reviewer to author today, so no clear is refused on those grounds yet.

What makes it a forcing function is what happens the moment it does land: subagents **inherit the parent session id**, so a subagent review would stop qualifying as independent. A CLI invocation **mints its own session id** — measured 2026-08-08: parent `01f39b97…`, child `f4386de9…`, and the child's own `CLAUDE_CODE_SESSION_ID` env var carries the child's id, which is the exact variable #2844 specifies reading. So the CLI is not merely the product direction; once #2844 lands it is the only mechanical way to get a genuinely independent reviewer without a human opening a window. That timing is the argument for doing this work before #1100 merges, not after.

## The one measurement we have (2026-08-08)

Three headless invocations of the same trivial prompt:

| configuration | cache created | cache read | cost |
|---|---|---|---|
| default config, warm-ish | 10,807 | 18,950 | $0.118 |
| stripped config, first run | 33,302 | 0 | $0.200 |
| stripped config, runs 2 and 3 | 0 | 33,302 | **$0.010** |

**The intuition was wrong and the number says so.** Making the reviewer "lighter" — a replaced system prompt, restricted tools, no MCP — was *more* expensive cold, because a new prompt prefix mints a new cache entry. The 20x saving came from the prefix being **byte-identical on the next call**. Prefix stability dominates prompt size.

Immediate consequences, if that holds:
- one **frozen** review prefix, never templated per PR — any per-PR text in the prefix destroys the cache for every other review;
- everything variable (the diff, the PR number, prior findings) goes **after** the stable prefix;
- reviews **batched in time**, because the cache has a TTL and ten reviews in a burst pay the prefix once.

Treat all of the above as a hypothesis from one sample on one day, not a finding.

## What we do not know — the research slice

Nobody here has current knowledge of prompt-caching and request-optimisation practice, and it is a fast-moving area. This slice is explicitly **research first, then design**:

- How does prompt caching actually behave — TTL, what invalidates a prefix, whether partial prefix reuse exists, how cache-creation is priced against cache-read?
- **Do we want one prefix or several?** A code reviewer, a docs reviewer and a security reviewer plausibly need different mandates. One shared prefix caches best; several specialised prefixes each cache separately and may each be small enough to win. This is the open question and the measurement should decide it, not taste.
- Does batching several small PRs into one invocation beat separate invocations that share a warm prefix?
- What do `--bare`, `--strict-mcp-config`, `--allowedTools`, `--no-session-persistence` and `--system-prompt` each actually cost or save? **`--bare` is untested here and carries a constraint**: it never reads OAuth or the keychain, so it needs `ANTHROPIC_API_KEY`. If this machine runs on a subscription, `--bare` may be unusable and that changes the design.
- Model choice per risk tier, and whether a cheap model can pre-filter for an expensive one.

**This research goes stale.** Pricing, caching behaviour and CLI flags all move. The slice must produce a **re-runnable measurement harness**, not a prose conclusion — so the numbers can be regenerated on demand rather than re-argued. Assume it is re-run periodically and write it for that.

## Cost comparison — instrumented, not a gate

Worth having, but explicitly **not** a reason to hesitate: the move happens regardless, so the point of measuring is to optimise it, not to decide it. Capture per-invocation cost, cache created versus read, and wall-clock, for subagent versus CLI on the same work, and keep it running so a regression is visible.

## Which calls move — the sweep

Enumerate every place the system spawns an agent today and decide, per call, whether it becomes a CLI invocation:

- **Reviews** — first, because the independence requirement #2844 specifies will force it once #1100 lands, and reviews are the highest-volume agent call.
- Fixers and builders acting on a review's findings.
- Rebases and conflict resolution.
- The scouting and item-selection passes.
- The converge daemon (#2572), which is the unattended case and needs a **stable identity of its own** — verified 2026-08-08 that the resident drain daemon runs with **no** `CLAUDE_CODE_SESSION_ID` at all. Under #2844 **as specified**, an absent id is an unknown clearer rather than an independent one, so the daemon would not satisfy the check it is about to be measured against.

## Procedural steps that should leave the model entirely

A separate and probably larger saving. Work the session manager currently does by reasoning, that is deterministic and belongs in a script:

- acquiring, refreshing and releasing lanes;
- sequencing concurrent reviews and collecting their verdicts;
- computing the net diff and passing it in, instead of each reviewer re-deriving it — this also removes the `FETCH_HEAD` clobbering that bit several agents on 2026-08-08;
- **skipping a re-review when the net diff is unchanged.** The machinery already exists: #2979's `reviewed-diff` fingerprint. Several PRs were fully re-reviewed that day after a push touching only a backlog card. The cheapest review is the one not run.

The hookable-vs-judgment rule applies: if a script can decide it, a script should.

## Likely slices

1. Research + a re-runnable measurement harness (answers the one-prefix-or-several question).
2. The review invocation wrapper: frozen prefix, diff on stdin, model by care level, fingerprint short-circuit.
3. Cost instrumentation and a baseline.
4. The call-site sweep and migration order.
5. Procedural steps out of the model and into scripts.
6. The converge daemon's own identity (couples to #2572).

## Done when

- Reviews run as CLI invocations with a frozen prefix, and the per-review cost is measured rather than estimated.
- The one-prefix-or-several question is answered by measurement and recorded.
- A re-runnable harness exists so the numbers can be regenerated when pricing or the CLI changes.
- Every agent call site has a decision recorded: moved, or deliberately kept in-session with a reason.
- A re-review is skipped when the net diff fingerprint is unchanged.
