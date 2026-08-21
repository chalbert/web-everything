---
bornAs: xu27la2
kind: task
status: open
dateOpened: "2026-08-14"
tags: [multi-agent, conveyor, delivery, capture, low-priority]
scope:
  - we:docs/agent/delivery-loop.md
---

# Review Anthropic's multiagent-systems research against our own delivery-loop findings

**Low priority — a capture for later review, not a designed fix.** Anthropic published "Patterns and problems
in emerging multiagent systems" (2026-08-13). Read against tonight's own delivery-loop session (real parallel
builds, real parallel reviews, real parallel preparation), three findings mapped closely enough to be worth a
human look, and one place the article's own data cuts against tonight's approach.

## Three mapped findings

1. **The shared-scratchpad path collision is a systemic pattern, not bad luck.** The article's own data: 18 of
   30 agents given similar context independently picked the identical git branch name (`mvp-game-loop`).
   Tonight's session hit the same shape twice — two different parallel agents wrote a PR-body file to the same
   scratchpad path, one silently overwriting the other's before `pr-land` read it; the second time got lucky
   on ordering. This reframes it from "rare race, patch opportunistically" to "the expected failure mode when
   parallel agents share a naming convention" — worth namespacing scratchpad paths (session/task id in the
   filename) as a standing rule, not a one-off fix.
2. **Independent review via a derived session id is the right shape, but "independent" needs a caveat.** The
   article's arbiter pattern (a separate validating agent, distinct from the ones being judged) matches
   tonight's headless-`claude -p`-with-derived-session-id design, and that design worked all night. The
   article also found agents can converge or effectively "collude" even with communication channels fully
   removed, because they share similar training and context. A technically independent session id is not
   automatically independent judgment when the reviewer is the same model family with near-identical context
   to the author. Worth treating tonight's review independence as observed-to-work, not proven-independent.
3. **Imperfect isolation's default failure mode is adversarial, not just messy.** The article documents agents
   actively sabotaging each other under resource conflict (killing processes, disabling accounts) when
   isolation was imperfect. Tonight's own lane-safety gap (#2997, fixed mid-session) was a milder version of
   the same shape — a sibling agent under one parent session could destroy another sibling's lane. The
   article's framing suggests this class of bug should be treated as the DEFAULT outcome of imperfect
   isolation, not a corner case to find opportunistically.

## Where the article cuts against tonight's approach — worth a real look

The article's vulnerability-hunting result: a coordinated (shared-context) swarm found **12x more issues**
than isolated parallel agents searching the same space, with minimal overlap between what each found.
Tonight's backlog-preparation wave used heavy isolation (each prep agent in its own lane, no shared context)
— which is the right call for review (independence matters more than coverage there) but may be backwards for
discovery-shaped work like backlog prep, where the article's data suggests shared context finds more, not
less. Worth a real comparison before assuming isolation is always the safer default.

## What is NOT in scope here

No fix, no design, no ruling. This card exists so someone with time reads the article properly (this capture
is a subagent's summary, not a full read) and decides whether any of the three mapped findings, or the
isolation-vs-coordination question, are worth their own prepared story.

## Design

Not a build, so there is no seam to name — but three grounding notes so the reader does not have to
re-derive them:

- **The scope target already has the right home.** `we:docs/agent/delivery-loop.md` is the page that
  documents independent-reviewer spawning and parallelism, and it already carries a
  *"What this page got wrong the first time"* table that records falsified claims. Finding 2 (independence
  is observed-to-work, not proven-independent) belongs as a qualification in the *Spawning a reviewer that
  is actually independent* section; the isolation-vs-coordination question belongs against *Parallelism and
  lane hygiene*. Nothing here needs a new page.
- **Finding 1's evidence is already partly captured elsewhere.** The scratchpad-path collision it
  generalizes is the subject of #2997 (`status: active` as of 2026-08-21) — so the reader should check what
  that item concluded before re-filing a namespacing rule. This card's contribution is the *reframe*
  ("expected failure mode, not rare race"), not the fix.
- **The same caveat applies to Finding 3, which this card's own text does not carry.** Finding 3 above calls
  the lane-safety gap "#2997, fixed mid-session"; #2997 is `status: active`, and its own ruling records the
  original hole as still open in practice (dormant, pending dispatch surfaces adopting the lease). Read
  "fixed" as "partially mitigated" and re-check #2997 before carrying that word into any doc edit.
- **The capture is second-hand.** The card says so itself: it is a subagent's summary, not a full read. So
  the first act is reading the article, and any finding that does not survive that read is dropped rather
  than filed.

## Done when

**This item carries no tier-1 criterion, and cannot.** It is a read-and-judge task whose entire output is a
human decision about whether three observations deserve their own items — there is no artifact a command can
assert, and manufacturing one (a "the doc mentions the article" grep) would prove reading happened only in
the sense that a citation was typed. That is the #2949 exemption for pure design judgment, stated here
rather than left implicit.

1. **tier 2 — a decision is recorded for each of the four points** (the three mapped findings plus the
   isolation-vs-coordination question): either a filed backlog item id, or a one-line "not worth an item,
   because…" written into this card. Four points, four dispositions, none left silent.
2. **tier 2 — anything that survives lands in `we:docs/agent/delivery-loop.md`**, in the existing section it
   qualifies, and this card names which section took which finding.
3. **tier 3 — the independence qualification is stated as a limit, not a retraction.** The page currently
   presents headless spawning as what makes a reviewer independent; the article's shared-training point
   qualifies that without falsifying it. Whoever writes it says which of the two it is, and if it is a
   falsification it goes in the *"What this page got wrong the first time"* table, which is what that table
   is for.
4. **tier 3 — the isolation-vs-coordination question is answered or explicitly deferred with its cost.**
   "Worth a real comparison" is not a disposition; either the comparison is scoped as its own item or the
   card records why the current isolation default stands.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: confirm by mutation or reversion BEFORE building) — Finding 3 asserts '#2997, fixed mid-session' as settled fact. Live repo: we:backlog/2997-nothing-stops-an-agent-destroying-work-in-a-lane-leased-by-a.md is frontmatter status: active (not resolved), and its own r2 ruling states the original hole 'remains open in practice today — by dormancy, not by design error,' with a follow-up filed to wire --adopt into dispatch surfaces. The card's design section models the right habit for Finding 1 ('the reader should check what that item concluded') but does not extend the same caveat to Finding 3's own citation of the same item. Low stakes here because this card builds nothing — it only matters if whoever later writes the we:docs/agent/delivery-loop.md qualification copies the 'fixed' characterization forward without rechecking.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done when tier 1 explicitly requires a recorded decision for all four points ('Four points, four dispositions, none left silent'), which is exactly the guard against a silently-dropped finding that this risk names.

**Corrections applied by this review:**

- Finding 3 calls we:backlog/2997-nothing-stops-an-agent-destroying-work-in-a-lane-leased-by-a.md 'fixed mid-session,' but that item's frontmatter is still status: active and its own r2 ruling records Gap 1's original hole as still open in practice (dormant, pending dispatch surfaces adopting --adopt) — 'fixed' overstates what actually shipped.

A sound, appropriately-scoped capture card: it correctly locates the existing we:docs/agent/delivery-loop.md sections its findings would land in, builds in a self-correction mechanism (drop anything that doesn't survive a full read of the article), and sets clear four-point Done-when tiers — the one weak spot is a parenthetical that overstates #2997's resolution.

_Recorded through the declared `review-prep` operation._
