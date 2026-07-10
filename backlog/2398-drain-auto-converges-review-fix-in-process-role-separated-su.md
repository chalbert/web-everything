---
kind: decision
status: resolved
dateOpened: "2026-07-10"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: xwfwuze
codifiedIn: "docs/agent/platform-decisions.md#agent-convergence-independent-validation"
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
> fork to decide but a **validation gate whose verdict is: resolve as graduated to the successor epic `xwfwuze`.** The survey and a
> hostile skeptic pass surfaced **two** genuine unshipped residues (a proactive scope threshold; in-drain
> red-CI auto-fix) — both *builds* (prioritization), not forks; the merit review below folds them into the
> single successor epic `xwfwuze` (superseding the earlier "file under #2285" framing).

## Digest + verdict

**Verdict: settled by precedent on the A/B fork — but the merit review (below) makes the actionable outcome a
BUILD, not two inert stories. Resolve #2398 as graduated to `xwfwuze` (successor to #2285) and build the red-CI convergence residue now
(unified engine + layered acceptance gate); Residue 1 is explicitly not built (it would regress the shipped
axis).** The mechanism #2398 proposes — a role-separated *fixer* subagent writes the fix, a
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

## Merit review (2026-07-10, `/next 2398` — "review for merit, most robust solution")

The A/B fork ("build the fixer vs. keep bounce-to-author") is genuinely settled — a role-separated
editor↔reviewer loop shipped under #2285. But reviewing the *shipped* loop against the "most robust" bar
surfaces the real question, which is not a residue-prioritization call at all. It's the **shape of the
convergence loop itself.**

### The bar: one loop, one completion condition

Convergence = two agents iterate until **ALL** of these hold, then land — else escalate to `review:human`:

> **approach agreed · implementation agreed · no reviewer issues · CI green**

There are not two loops (a "review" loop and a "red-CI" loop) and there are no separate "residues." A red CI
check is simply **one member of the "no issues" set** — the deterministic, unfakeable member (a machine check,
not an agent opinion). "Keep fixing until CI is green" is just the loop refusing to declare agreement while a
known issue is open. So CI-green folds into the single completion bar rather than being its own feature.

### Where the shipped loop falls short of the bar

The shipped loop is **fix-first / asymmetric**: an *editor* writes a fix, a *fresh reviewer* grades it
(accept / changes), repeat up to `NEGOTIATION_ROUND_CAP` (`we:scripts/lib/review-core.mjs:210-213`). Two gaps
against the bar:

1. **No approach agreement before code is written.** The editor guesses at a fix and the reviewer only reacts;
   rounds get burned when the fix aimed at the wrong target. The robust loop agrees on **approach first**, then
   implements — a handshake phase ahead of the diff.
2. **CI-green is not in the completion condition.** Today `deriveNegotiationOutcome` lands on a fresh reviewer's
   `accept` alone; a PR whose only defect is a red required `test` strands for human `/finish`
   (`we:scripts/lane-resume.mjs:79-81`) instead of being part of the same convergence. Add "CI green" as a
   necessary clause of the land condition — deterministic, so the agents can't fake it; guard the one failure
   mode (a fix that goes green by **weakening the test**) with the fresh non-author reviewer, who sees the diff
   *including* test changes and treats test-weakening as `changes`/`needs-human`.

### The fork: A vs. B (recommend B)

The one live decision is **where the independent check sits**, forced by the invariant *a landed PR must be
accepted by an agent that did not author the fix*:

- **A — fresh reviewer every round** (shipped): editor writes, an independent fresh reviewer grades, repeat.
  Maximal independence; but the editor guesses and the reviewer only reacts, so rounds burn on wrong-target fixes.
- **B — two peers co-negotiate approach + implementation, then a *distinct* fresh agent validates the final
  diff:** fast approach agreement, invariant preserved because the final acceptor didn't participate in the
  negotiation. Costs one extra role. **Chosen (2026-07-10).**

### Best-practice grounding (research → `we:reports/2026-07-10-ai-code-review-best-practices.md`)

A web survey of production AI-review systems and the LLM-judge literature **supports B** and sharpens it. Two
findings are load-bearing and change the build:

1. **The two co-negotiating peers are NOT independent of each other** — they share priors, and "two authors
   agreeing" is consensus, not validation (multi-agent debate gains can be shallow social agreement). So the
   *entire* invariant rests on the third validator. Harden it: **adversarial "find the reason to reject"
   persona, rubric-anchored verdict, fresh context, and ideally a different model/provider** than the peers (or
   a small diverse **panel/jury** — a 3-way panel beat a single large judge at ~7× lower cost while diluting
   self-preference/position/verbosity bias). **Do not feed the validator the peers' self-assessment** (sycophancy
   → it ratifies); give it diff + tests + rubric only. *(coderabbit; arxiv 2412.05579, 2410.21819, 2308.07201)*
2. **"CI green" is directly hackable** — agents demonstrably weaken/delete tests or special-case outputs to go
   green (documented reward-hacking). The CI-green clause needs **anti-test-gaming gates**: test files read-only
   to the author peers (or diff-gate any test change), fail the land if coverage drops or tests are
   removed/skipped, require a test that fails on pre-change behavior for logic fixes, and have the validator
   explicitly inspect for test tampering. *(github.blog; arxiv 2606.07379, 2605.21384)*

Empirical backdrop: real agent-fix PRs are merged only ~65% of the time (test failures 18% + incorrect fix 15%
dominate rejections), which validates the round-cap-then-escalate discipline and the off-by-default rollout.

### The build

Extend the existing `deriveNegotiationOutcome` engine (do NOT add a parallel path) so the loop is:

- **approach handshake** → the two peer agents agree on the fix approach before any code is written;
- **implement** → editor writes it in an isolated throwaway clone, pushes to the same PR branch (#2336
  never-move-shared-HEAD invariant preserved);
- **independent validation** → a *distinct fresh* validator (adversarial, rubric-anchored, given diff+tests+rubric
  only — never the peers' self-assessment; a diverse panel is the stronger form) judges the final diff;
- **land only when the full bar holds** — approach agreed · validator `accept` · `check:standards` green ·
  required `test` green · **no test-tampering** (coverage not dropped, no tests removed/skipped, logic fixes carry
  a test that fails on pre-change behavior);
- **escalate** on non-convergence (round cap) or `needs-human`, unchanged (one escalation shape → `review:human`).

Blast-radius stays contained: the fix happens in the throwaway clone and CI re-runs *on GitHub*, not in the
drain's serial-writer tree. Ship behind an off-by-default flag, scoped to small/well-tested/non-security diffs
first, graduating per-repo on a clean track record (staged-autonomy norm).

## Recommendation

**Resolve #2398 as graduated to `xwfwuze` (successor to #2285) and build the unified convergence loop** — approach-handshake-first, with
the single completion bar (approach agreed · no reviewer issues · CI green). Do not re-decide the A/B fork
(shipped), do not close as a bare duplicate, and do **not** file inert "not-yet" residue stories — the CI-green
clause and the approach handshake are two parts of *one* loop, not two separately-prioritized builds.

**Skeptic:** SURVIVES-WITH-AMENDMENT (hostile pass, default "the duplicate call is wrong"). The core-is-shipped
finding held on every angle — the loop genuinely shipped into the live drain (SKILL ceremony + pure helpers,
the same execution model as the rest of the drain, `we:skills-src/drain/SKILL.md:199-246`), red-CI is correctly
*not* the core, and no invariant is left unaddressed. **Amendment:** the residue is **two** pieces, not one —
the skeptic surfaced the proactive scope threshold (Residue 1) alongside the red-CI item (Residue 2); both
folded in above. Verdict adjusted from "close as duplicate" to "resolve as graduated to `xwfwuze` + build one
unified convergence loop" — the merit review below folds the two pieces into slices of that single successor
epic, not two separately-filed stories.

**Screen:** clear (fresh-context two-confusion). (1) *Boundary* — clear: the drain's in-process subagent
choreography is WE-internal orchestration (`we:scripts/merge-ai-prs.mjs` + `we:scripts/lib/review-core.mjs`),
no consumer-visible surface across the WE↔FUI↔Plateau boundary; correctly placed. (2) *Merit vs prioritization*
— flagged(prio): the non-author invariant is preserved in **both** branches, so no merit difference survives
free-and-maintained; the A/B "fork" is prioritization in costume. **Fix applied:** the item is authored as a
settled-by-precedent ruling graduated to a single unified build (epic `xwfwuze`), not as a merit fork with a pick.

---

*Complements the overlap-stack coordination theme (stacking kills *conflict* round-trips; #2285 already killed
*review* round-trips). Ruling this graduates it to `xwfwuze` (the successor epic to #2285); it does not itself build anything.*
