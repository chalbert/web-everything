---
kind: decision
status: open
dateOpened: "2026-07-10"
tags: [drain, review, coordination, subagents]
---

# Drain auto-converges review/fix in-process (role-separated subagents) vs. bounce review:changes to the author

Today a `review:changes` verdict bounces the PR back to the author lane to fix + repush — a **cross-session round-trip** (drain → author → drain). Since the drain (`we:scripts/merge-ai-prs.mjs`) already runs review via subagents in-process, should it also run the **fix** in-process — a role-separated *fixer* subagent writes the change to the lane ref, a *distinct fresh reviewer* subagent then accepts — converging in-drain with no bounce? This complements the overlap-stack epic ([#2387](/backlog/2387/)): stacking kills *conflict* round-trips; this kills *review* round-trips. Together a serial batch lands with near-zero cross-session hops.

## The invariant it must preserve (and how)

The hard constraint is the **non-author review invariant**: *a landed PR was accepted by an agent that did not author it.* A drain that both writes a fix and merges it is literal self-approval. The resolution is **role separation inside the drain's own subagent fleet** — the fixer agent authors the change; a **separate, fresh** reviewer agent (never the fixer) reviews the fixed diff; merge only on that reviewer's accept. Everything stays in one drain process, but no single agent both authors and approves. The reviewer is already in the drain today (`we:scripts/lib/review-core.mjs`); this only adds a role-separated fixer alongside it.

## Guardrails (the real design work, if we say yes)

- **Scope threshold** — auto-converge only *cheap / mechanical* fixes (lint, a failing assertion, a review nit); **escalate** anything needing product judgment, large redesign, or touching risky files. The drain already carries the signals to draw this line: `dismissedFindings`, `mergeRiskFiles`, and the escalation scorer (`we:scripts/lib/review-escalation.mjs`).
- **The #2285 human carve-out** — if the fix touches the auto-review trust chain, it stays `review:human` and only a human clears it; the in-drain fixer must respect the same carve-out.
- **Red-CI fixes** — the drain fixing a red `test` check is the same capability as `/finish --fix` (`we:scripts/lane-resume.mjs`, off by default), moved into the drain. Riskier than a review nit; gate it behind the reviewer subagent + the escalation threshold above.
- **Cost / role-creep** — the drain becomes a *convergence engine*, not just a lander: longer-held lease, more tokens, a bigger failure surface in the sole-serial-writer process. This is the main argument *against*.

## The fork

**Option A (bold default) — auto-converge the cheap class, escalate the rest.** Add a role-separated fixer subagent to the drain; auto-fix + re-review + land only for mechanical/nit-class `review:changes` (and, behind a flag, red-CI), escalating judgment-heavy or trust-chain fixes to `review:human` / bounce-to-author. Rationale: kills the common-case round-trip where it's safe, keeps the invariant via role separation, and reuses the existing escalation signals to bound the risk. Precedent exists (`/finish --fix`).

**Option B — keep bounce-to-author.** Simpler drain, smaller blast radius, no new self-approval surface to reason about; every fix is authored by a genuinely separate session. Rationale: the drain stays a *lander*, not a convergence engine; the coordination round-trip is the price of a hard trust boundary.

**Recommendation:** A, scoped tightly — the win (no bounce on the common cheap case) is real and the invariant is preservable by construction, but only if the scope threshold and the #2285 carve-out are enforced from day one. If we can't cleanly classify "cheap vs judgment," fall back to B.

*Not blocked by [#2387](/backlog/2387/) — independent, same coordination-reduction theme. Ruling this fork spawns the build story/epic; it does not itself build anything.*
