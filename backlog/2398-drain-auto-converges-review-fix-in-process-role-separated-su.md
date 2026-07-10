---
kind: decision
status: open
dateOpened: "2026-07-10"
preparedDate: "2026-07-10"
relatedReport: reports/2026-07-09-drain-in-process-convergence-precedent.md
tags: [drain, review, coordination, subagents, settled-by-precedent]
---

# Drain auto-converges review/fix in-process (role-separated subagents) vs. bounce review:changes to the author

> **Prep note (2026-07-09, `/prepare all`) — reshaped to a validation gate, not a fork.** A precedent survey
> (report [we:reports/2026-07-09-drain-in-process-convergence-precedent.md](../reports/2026-07-09-drain-in-process-convergence-precedent.md))
> found the core question is **already ratified and shipped** under epic
> [#2285](/backlog/2285-negotiated-agent-review-for-the-drain/) (all children resolved). The original A/B fork
> ("build the in-process fixer vs. keep bounce-to-author") is **settled by precedent** — so this is not a merit
> fork to decide but a **validation gate whose verdict is: resolve as graduated to #2285.** The survey and a
> hostile skeptic pass surfaced **two** genuine unshipped residues (a proactive scope threshold; in-drain
> red-CI auto-fix) — both *builds* (prioritization), not forks — to file under #2285.

## Digest + verdict

**Verdict: settled by precedent — no live fork; resolve #2398 as graduated to epic #2285, filing two residue
build-stories under it.** The mechanism #2398 proposes — a role-separated *fixer* subagent writes the fix, a
*distinct fresh reviewer* subagent accepts, converging in-drain with no author bounce — is exactly the
editor↔reviewer negotiation loop shipped by #2311/#2310 and wired into the live drain by #2326:

- **The fixer.** `we:scripts/lib/review-core.mjs:170` `buildEditorMandate()` seeds a fresh-context editor
  subagent that fixes the reviewer's findings in an **isolated throwaway clone** of the PR branch and pushes
  back to the **same** branch (`:181-183`) — it never merges its own change (invariant preserved by
  construction).
- **The distinct fresh reviewer.** `we:skills-src/drain/SKILL.md:241-242` re-spawns the full fresh-context
  reviewer panel on the updated diff each round; `we:scripts/lib/review-core.mjs:210`
  `deriveNegotiationOutcome()` only `land`s on a fresh reviewer's `accept`.
- **The author-bounce is retired.** `we:skills-src/drain/SKILL.md:167-168` — *"v2 (#2311) **replaces v1's
  author-bounce with a bounded editor↔reviewer negotiation loop**"*; `:226-227` — non-convergence applies
  `review:human`, *"never `review:changes`/author-bounce — that path is retired by v2."*
- **The invariant #2398 names** (*a landed PR was accepted by an agent that did not author it*) is the same one
  #2285 preserves via role separation. #2398 cites #2285's **v1** carve-out/invariant but never mentions
  #2311/#2310 — it reads as filed unaware v2/v3 already shipped fix-in-process.

## Prior-art delta

- **Internal (dispositive):** epic [#2285](/backlog/2285-negotiated-agent-review-for-the-drain/) and children
  [#2325](/backlog/2325-extract-a-shared-review-verdict-core-so-code-review-the-drai/) (review-core contract),
  [#2311](/backlog/2311-v2-editor-reviewer-negotiation-loop-drain-auto-fixes-to-conv/) (the editor loop),
  [#2310](/backlog/2310-v3-multi-mandate-reviewer-panel-unanimous-accept-lands-confl/) (the panel),
  [#2326](/backlog/2326-review-human-verdict-skill-drain-reuses-the-review-core-advi/) (live wiring) — **all
  resolved**. This is the same-repo precedent that settles the fork.
- **External (supporting):** author↔reviewer separation on check overrides (CodeRabbit restricts overrides to
  non-author reviewers), merge-queue AI auto-fix (Trunk.io, Ellipsis AI — the latter gated on explicit
  authorization, analogous to our `humanRequired` carve-out), and an
  [empirical study](https://arxiv.org/html/2602.00164v1) showing agent-fix PRs frequently fail review and go
  unmerged — which *validates* #2285's round-cap-then-escalate discipline. No external capability is missing
  from #2285.

## Why this is not a fork

Running the standing fork-existence test: the two branches as filed (**A** build the fixer / **B** keep
bounce) do not genuinely fail to coexist and neither is *broken* — because **A is already built**. The
"decision" collapses to a dispositive **settled-by-precedent** route (the pass-0 / pass-4 axis-0 classification
outcome). The fresh-context two-confusion screen independently reached the same place: the non-author invariant
holds in *both* imagined branches, so no merit difference survives — the A/B question is **prioritization in
fork costume**, not a ratifiable merit call. There is nothing here for a human to *judge*; there is a precedent
to *cite* and two builds to *prioritize*.

## The two residues (builds under #2285, both default not-yet)

Neither is a merit fork (the screen: the invariant holds regardless), so each is a build recommendation with a
bold default the decision turn ratifies-or-overrides, filed as a story under #2285 — not decided here.

### Residue 1 — proactive cheap-vs-judgment scope threshold

#2398 Option A proposed auto-fixing *only* the cheap/mechanical class and escalating judgment-heavy fixes
**immediately**. #2285 ships a **reactive** model: every agent-reviewable `changes` verdict burns up to
`NEGOTIATION_ROUND_CAP` (3) editor rounds, then escalates on non-convergence
(`we:scripts/lib/review-core.mjs:210-213`). The classifier signals #2398 names
(`dismissedFindings`/`mergeRiskFiles`, `we:scripts/lib/review-escalation.mjs:55,103,121`) today gate
*park-vs-not*, not *fix-vs-escalate*.

- **Recommended default: not-yet.** The round cap already bounds the wasted effort on a non-converging
  judgment-heavy fix to 3 rounds and then escalates — a proactive classifier adds a new judgment surface
  (misclassification risk: a "cheap-looking" fix that is actually load-bearing) for a bounded saving.
- **Concrete un-gate trigger:** instrument editor-round consumption in real drain runs; if judgment-heavy
  fixes routinely burn the **full 3 rounds** before escalating (measurable waste), file the proactive gate.

### Residue 2 — in-drain red-CI (`test-red`) auto-fix

#2285's loop fixes *review findings*; it does not fix a PR whose only defect is a red required `test` check.
Today a `test-red` lane is recovered by the **separate** `/finish` / `lane-resume` flow
(`we:scripts/lane-resume.mjs:81` — `test-red` disposition → finisher subagent fixes the code), which is
human/agent-initiated, not auto-run inside the unattended `/drain`.

- **Recommended default: not-yet (behind an off-by-default flag when built).** Fixing a real code bug
  unattended is strictly riskier than a review nit — longer lease, bigger blast radius in the sole-serial-writer
  drain process. Keep it in human-initiated `/finish` until the review-convergence loop is proven stable in
  practice.
- **Concrete un-gate trigger:** after the review-convergence loop has run cleanly across a batch of real drains
  (no invariant regressions), fold the `lane-resume` finisher into `/drain` behind a flag, reusing the same
  role-separation + escalation.

## Recommendation

At the decision turn: **resolve #2398 as settled-by-precedent / graduated to #2285.** Do not re-decide the A/B
fork (it is shipped), and do not close as a bare duplicate (that silently drops the residues) — file Residue 1
and Residue 2 as stories under epic #2285, each carrying its bold *not-yet* default + concrete trigger above.

**Skeptic:** SURVIVES-WITH-AMENDMENT (hostile pass, default "the duplicate call is wrong"). The core-is-shipped
finding held on every angle — the loop genuinely shipped into the live drain (SKILL ceremony + pure helpers,
the same execution model as the rest of the drain, `we:skills-src/drain/SKILL.md:199-246`), red-CI is correctly
*not* the core, and no invariant is left unaddressed. **Amendment:** the residue is **two** pieces, not one —
the skeptic surfaced the proactive scope threshold (Residue 1) alongside the red-CI item (Residue 2); both
folded in above. Verdict adjusted from "close as duplicate" to "resolve as graduated + file two build-stories."

**Screen:** clear (fresh-context two-confusion). (1) *Boundary* — clear: the drain's in-process subagent
choreography is WE-internal orchestration (`we:scripts/merge-ai-prs.mjs` + `we:scripts/lib/review-core.mjs`),
no consumer-visible surface across the WE↔FUI↔Plateau boundary; correctly placed. (2) *Merit vs prioritization*
— flagged(prio): the non-author invariant is preserved in **both** branches, so no merit difference survives
free-and-maintained; the A/B "fork" is prioritization in costume. **Fix applied:** the item is authored as a
settled-by-precedent ruling + two separately-prioritized builds, not as a merit fork with a pick.

---

*Complements the overlap-stack coordination theme (stacking kills *conflict* round-trips; #2285 already killed
*review* round-trips). Ruling this graduates it to #2285; it does not itself build anything.*
