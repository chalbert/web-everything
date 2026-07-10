# Drain in-process review/fix convergence — precedent survey (prep for #2398)

**Date:** 2026-07-09 · **Session:** `/prepare all` · **Item:** [#2398](/backlog/2398-drain-auto-converges-review-fix-in-process-role-separated-su/)

## Question as filed

#2398 asks whether the drain (`we:scripts/merge-ai-prs.mjs` + the `/drain` skill) should **auto-converge
review/fix in-process** — a role-separated *fixer* subagent writes the change to the lane ref, a *distinct
fresh reviewer* subagent then accepts — instead of bouncing a `review:changes` verdict back to the author lane
(a cross-session round-trip). It frames this as a fork: **A** (build the in-process fixer, scoped to cheap
fixes) vs **B** (keep bounce-to-author).

## Finding: the core is already ratified and shipped (epic #2285)

The exact mechanism #2398 proposes is **already built and resolved** under epic
[#2285](/backlog/2285-negotiated-agent-review-for-the-drain/) — *"Negotiated agent
review for the drain — auto-review → editor negotiation → mandate panel."* All children are `resolved`:

| Item | What it shipped | Relevance to #2398 |
| --- | --- | --- |
| #2325 | Shared review-verdict core (`we:scripts/lib/review-core.mjs`) | The single-sourced `{findings, verdict}` contract both the fixer and reviewer render through. |
| #2311 (v2) | **Editor↔reviewer negotiation loop — "drain auto-fixes to convergence"** | `buildEditorMandate()` seeds the **fixer**; `deriveNegotiationOutcome()` lands only on a **fresh reviewer's** accept. **Explicitly "replaces v1's author-bounce."** This *is* #2398's Option A. |
| #2310 (v3) | Multi-mandate reviewer panel (correctness/security/simplicity/standards lenses) | The reviewer half fanned out; unanimous mandatory accept lands, conflict → `review:human`. |
| #2326 | Drain wires the review-core; advisory AI take even on `review:human` | The live `/drain` procedure that runs the loop. |

Concrete grounding:

- `we:scripts/lib/review-core.mjs:170` `buildEditorMandate()` — the fixer editor writes in an **isolated
  throwaway clone** of the PR branch and pushes back to the **same** branch (`:181-183`); the non-author
  invariant is preserved *by construction* (the editor never merges its own change).
- `we:scripts/lib/review-core.mjs:210` `deriveNegotiationOutcome()` — the deterministic
  `continue`/`land`/`escalate` round-cap decision; `land` requires a **fresh-context reviewer's** `accept`.
- `we:skills-src/drain/SKILL.md:167-168` — *"v2 (#2311) **replaces v1's author-bounce with a bounded
  editor↔reviewer negotiation loop**."* `:226-227` — on non-convergence the drain applies `review:human`,
  *"never `review:changes`/author-bounce — that path is retired by v2."*
- `we:skills-src/drain/SKILL.md:233-242` — steps 4–5: spawn a fresh-context **editor** subagent (fix), then
  re-spawn the full **panel** (fresh reviewers) on the updated diff — literally #2398's "fixer subagent + a
  distinct fresh reviewer subagent" split.

The invariant #2398 says "it must preserve" (*a landed PR was accepted by an agent that did not author it*) is
the same invariant #2285 preserves via role separation. #2398 cites #2285's **v1** carve-out and invariant but
**never mentions #2311/#2310** — it appears filed unaware that v2/v3 already shipped the fix-in-process loop.

## External prior art (industry landscape)

The pattern #2285 shipped is the current industry standard for AI-assisted merge queues:

- **Author↔reviewer separation on check overrides** — CodeRabbit restricts check-override to requested
  reviewers (not the PR author), recording who overrode, for auditability. Mirrors #2285's role separation.
- **Merge-queue AI auto-fix** — Trunk.io bundles a merge queue with AI root-cause on failing checks; Ellipsis
  AI auto-fixes on merge-request comments *only when explicitly authorized* (a safety gate analogous to the
  `humanRequired` carve-out).
- **AI-fix PRs frequently fail review** — an [empirical study](https://arxiv.org/html/2602.00164v1) finds
  agent-authored fix PRs often fail code review and go unmerged, wasting compute. This validates #2285's
  **round-cap-then-escalate** discipline (bound the wasted rounds; escalate non-convergence to a human) over an
  unbounded auto-fix loop.

Delta vs. our design: nothing in the external landscape suggests a capability #2285 lacks; if anything the
empirical evidence reinforces the round-cap our design already adopted.

## The two genuine residues (NOT shipped by #2285)

A hostile skeptic pass (default: "the duplicate call is wrong") could not break the core-is-shipped finding,
but surfaced **two** pieces #2285 genuinely does not cover — both *builds* (prioritization), not merit forks:

1. **Up-front cheap-vs-judgment scope threshold.** #2398 Option A proposes auto-fixing *only* the
   cheap/mechanical class and escalating judgment-heavy fixes **immediately**. #2285 ships a **reactive**
   model instead: every agent-reviewable `changes` verdict burns up to `NEGOTIATION_ROUND_CAP` (3) editor
   rounds, *then* escalates on non-convergence (`we:scripts/lib/review-core.mjs:210-213`). The signals #2398
   names (`dismissedFindings`, `mergeRiskFiles`) live in `we:scripts/lib/review-escalation.mjs:55,103,121` but
   gate **park-vs-not**, not **fix-vs-escalate**. A proactive classifier that short-circuits judgment-heavy
   fixes before spending rounds is a real, unshipped refinement.
2. **In-drain red-CI (`test-red`) auto-fix.** #2285's loop fixes *review findings*, not a PR whose only
   problem is a red required `test` check. Today a `test-red` lane is recovered by the **separate** `/finish` /
   `lane-resume` flow (`we:scripts/lane-resume.mjs:81` — `test-red` disposition → finisher subagent fixes the
   code), which is human/agent-initiated, not auto-run inside the unattended `/drain`. Folding that finisher
   into the drain is a distinct, riskier capability (fixing a real code bug unattended vs. a review nit).

Both residues are **prioritization**, not merit forks: the non-author invariant holds either way, so the only
question is *build now vs. later* plus cost (longer lease, more tokens, bigger blast radius in the sole-serial
writer). The recommended default on both is **not-yet**, filed as stories under #2285 with concrete triggers.

## Recommended disposition (for the decision turn)

**Resolve #2398 as settled-by-precedent / graduated to #2285** — the core fork (fix-in-process vs bounce) is
already ruled and shipped. Do **not** re-decide it as an A/B fork, and do **not** close it as a bare duplicate
that silently drops the residues: file the two residue stories under epic #2285, each defaulting to *not-yet*
with the trigger stated in the item.
