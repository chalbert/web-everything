---
bornAs: cvg2563r
kind: decision
size: 8
status: open
dateOpened: "2026-07-18"
tags: [drain, review, convergence, escalation, console]
---

# Blast-radius is advisory care-level, not a park-gate — converge-by-default, human only on non-convergence, console re-round

Reshape the drain review model so a **human is reached only when the agent convergence loop fails to
land** — not because a deterministic rubric signal (blast-radius, size, …) fired. Blast-radius becomes
**advisory care-level metadata** that raises reviewer scrutiny *inside* the loop; it never by itself parks a
PR to a human. Add a **console action to send a parked PR back for another convergence round**, optionally
with a steering guideline.

## The problem (verified 2026-07-18)

Today a blast-radius PR bounces to the human and the fix/review convergence loop **never ran on it**, because
the loop and the parking decision live in **different execution layers**:

- **Parking is deterministic script work.** `scoreEscalation` (`we:scripts/lib/review-escalation.mjs`) sets
  `escalate=true` on a blast-radius hit and the label is stamped by **multiple producers**, none of which run
  the loop: `we:scripts/pr-land.mjs` at PR-OPEN (#2307, born parked), `we:scripts/merge-ai-prs.mjs` at
  merge-time, and the review-only `we:scripts/workflows/review-parked-prs.mjs` panel (#2437, which explicitly
  **defers** the editor↔fix loop to #2285/#2410).
- **The convergence loop is agent choreography** — it lives only in `we:skills-src/drain/SKILL.md` and needs
  the `Agent` tool to spawn editor/reviewer subagents.
- **The always-on automation cannot run it.** The drain daemon (`plateau-app:tools/drain-daemon/daemon.mjs`)
  was deliberately de-scoped to **"no agent spawning"** (2026-07-11 red-team) — it runs
  `we:scripts/merge-ai-prs.mjs` as a plain node child every 60s. It parks blast-radius PRs with
  `review:pending` and moves on. Nothing schedules an agent-side `/drain` or the parked-prs workflow, so the
  park sits until a human hand-runs `/drain` or `/review`.

Net: "converge before human" (v2, #2311) shipped as a **skill ceremony** but was **never wired into the
automated queue**, so in practice blast-radius parks are a human bounce.

## The reframe (operator, 2026-07-18)

1. **Blast-radius is not a gate — it's care-level information.** It tells whoever/whatever reviews how much
   care to take. It must not, on its own, route a PR to a human.
2. **Care-level ≠ skip review.** A high care-level still gets a review; it just changes scrutiny, not the
   route.
3. **Human review only if convergence does not land.** The agent convergence loop is the default path for
   escalated PRs. A human is the fallback for non-convergence (round cap / mandate conflict), not the front
   door.
4. **Console re-round.** From the operator console, a human can send a parked PR back for another convergence
   round — **with or without a guideline** to steer the next round.

## Scope / forks to prepare

- **F1 — Demote blast-radius (and size/sampling/dismissed-findings/cross-repo) from `escalate`→park to a
  care-level annotation.** These become a `careLevel` signal that rides the PR (label/body) and raises loop
  scrutiny, without setting the human-park action. Keep the HARD gates hard: `humanRequired`
  (`isGateSelfPath` / `isStatutePath`) still forces a human. Fork: do the hard gates ALSO attempt
  convergence-with-advisory first (operator leans yes — "human only if convergence does not land"), or stay
  straight-to-human? Resolve against the conflict-of-interest invariant.
- **F2 — Make convergence the default automated path.** Since the daemon cannot spawn agents, the trigger must
  be agent-side: a scheduled agent / cron / `/loop` that runs the convergence workflow over the
  `review:pending` set, OR extend `we:scripts/workflows/review-parked-prs.mjs` (#2437) to stop deferring and
  actually run the editor↔reviewer loop (finishing #2410). Decide where the trigger sits.
- **F3 — Console re-round action.** In the loop/evidence console (#2494), add "send back for another round"
  with an optional free-text guideline that seeds the next `buildEditorMandate()` / panel round. Persist the
  guideline as part of the round history.
- **Invariant preserved throughout:** a landed PR is accepted by an agent (or human) that did **not** author
  the fix (#2285/#2439). Care-level demotion must not weaken this.

## Related

Successor design over epic #2285 (negotiated agent review) and its open successor #2410 (unified convergence
loop); consumes #2437 (parked-PR workflow) and #2494 (loop console). Renders through the shared review core
(`we:scripts/lib/review-core.mjs`, #2325). Gate-self: this edits the review trust chain, so any implementing
diff is `review:human` and a human clears it.
