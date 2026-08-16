---
bornAs: xm1fefh
kind: decision
parent: "1855"
status: open
dateOpened: "2026-08-07"
preparedDate: "2026-08-16"
relatedReport: reports/2026-08-16-prepare-2981-judgment-split.md
tags: []
---

# Can judgment work split into a delegated draft half and an inline call half, and what grounds the call?

Delegate-by-default (#1855, PR #1075) inverted execution routing but deliberately left judgment work —
selection, the decision arc, slicing/splitting, preparing a fork — inline. A stronger claim was drafted
into that PR and **carved back out**: that each of these splits, with the *work* half (survey prior art,
draft the fork's options, draft the slice breakdown) going to an Opus sub-agent and only the *call* half
staying on the loop. It is attractive — `/prepare-decision-item` is arguably already that shape — but the
grounding story does not hold, so it needs a ruling rather than a paragraph. This item was carved out of
PR #1075 as its own item rather than settled inline (the shape #2950 prescribes for a finding that
introduces a new goal instead of serving the item's stated one).

## Why the original draft failed review

Two `security` jurors, independently, in separate `/converge` rounds on the PR #1075 panel, killed the
originally-shipped "split everything" language:

- **Row 2 cannot ground it.** `we:docs/agent/backlog-workflow.md:481` justifies keeping the call inline by
  requiring the loop to *"open the artifact it rules on… not only a sub-agent's account of it"*, because
  *"a summary cannot show what it left out."* For a `decision`/`slice`/`prepare` the artifact **is** the
  sub-agent's writeup — the very thing row 2 disqualifies. The loop would rule on the proposal using the
  proposal as its own evidence.
- **The blast-radius axis was dropped.** The superseded Sonnet gate required bounded blast radius (single
  locus, no contract/shared-gate/cross-repo seam). That bullet did two jobs — deciding who rules **and**
  guaranteeing the ruler had context. The rewrite kept the first and lost the second, so the
  highest-blast-radius class would get a verdict formed on draft text alone.

Carved back out in `d14554a6` ("Carve #1075 back to the rename + inversion it started as"); the shipped
text today (`we:docs/agent/backlog-workflow.md:489`) explicitly parks the question here.

## Fork 1 — does judgment execution ever split, and under what boundary?

**Fork-existence justification.** An item's judgment execution is either fully on the loop or partially
delegated — never both at once — so a real either/or sits between "always inline" and "sometimes split."
Option (c) below is the excluded branch: it is the exact language already tried once in a real PR and
rejected twice on the record for a concrete, still-unfixed defect (below), so it is not a live alternative
as stated. The live tension is between (a) and (b).

**(a) Never split — status quo.** All judgment-shaped work (`decision`/`slice`/`prepare`, any size) stays
fully on the loop: the loop surveys prior art, drafts the fork, and rules on it, in the same session. Cost:
the loop pays full context for every survey and draft — the exact thing delegate-by-default exists to avoid
everywhere else.

**(b) A bounded "sanctioned exception."** Splitting is permitted only for small, single-fork judgment work
whose blast radius excludes a shared gate/contract/cross-repo seam (the Sonnet rung's own bounded-blast-radius
test), gated behind two new mechanisms: (i) an **explicit read carve-out** — before ruling, the loop
independently re-opens the concrete `file:line` refs the sub-agent's draft cites, rather than reading only the
draft's prose account of them; (ii) a **deterministic backstop** — `check:health` G4 (false-prepared-fork,
`we:scripts/audit-backlog-health.mjs:118,388`) and D1 (dead `file:line` refs, `we:scripts/audit-backlog-health.mjs:432`)
already exist; binding them as a *required* pre-ratification run on any delegated-draft item would make part
of the grounding machine-checkable instead of remembered. **Shown non-viable as specified** — see the skeptic
verdict below; kept here, named, because the defect and the fix-that-doesn't-work are worth recording rather
than silently dropping (per *supersedes with lineage, never erases*).

**(c) General — split by default for any judgment kind.** No bound at all; the exact language PR #1075
shipped and that got carved back out twice. **Excluded** — the fork-existence branch above.

**Recommended default: (a).** Not on cost — on the structural grounding gap. `we:docs/agent/backlog-workflow.md:506`
already states the general form of the problem this item is really asking about: *"An absence claim is
different in kind — spot-verify cannot reach it… there is **no size escape**."* A drafted fork's omissions
(what the sub-agent chose *not* to survey, *not* to mention, *not* to weigh) are exactly an absence claim —
"nothing else relevant exists" — and no citation-recheck of what *was* cited can establish what wasn't. That
is a structural limit, not a resourcing one: it would hold even with unlimited engineering effort spent on
the carve-out mechanism, because verifying a completeness claim without redoing the underlying survey is not
a tooling gap, it is definitionally redoing the survey. Token cost is real but secondary, and the repo's own
standing asymmetry bias already resolves it: *"when torn between tiers, go up… under-spending writes a bad
ruling into the backlog graph"* (`we:docs/agent/backlog-workflow.md` → Model routing).

**Skeptic:** Ran a four-axis attack (classification / merit / statute-overlap / citation-scope) against the
drafted (b) default. **Merit — REFUTED**: the read carve-out re-verifies what a draft *cited*, not what it
*omitted* — `:506`'s absence-claim rule already forecloses exactly this fix, so (b)'s core mechanism is a
presence-check dressed as an omission-check. **Citation-scope — REFUTED**: (b) borrowed row 4's spot-verify
(one load-bearing claim, about to be acted on) as authority for a comprehensive re-verification of an entire
argued position — the same authoring-scope overreach as the #1913 miss. **Statute-overlap — real collision
found**: `we:docs/agent/backlog-workflow.md:499-500`'s Sonnet rung already excludes judgment-shaped work from
any blast-radius exception "however small… it looks" — (b) reintroduces precisely the exception that clause
forecloses; ratifying (b) as drafted would leave that clause silently contradicted. **Classification —
survives-with-amendment**: `:489`/`:506` already lean toward (a) as precedent, so the genuinely open question
is narrower than originally framed — not "should we split," but "could a future mechanism ever close the
omission gap," which this item does not need to answer. Default flipped from the original (b)-leaning draft
to (a) on these findings.

**Screen:** Q1 (impl-detail leak) — clear: execution routing changes what backs the ruling's correctness, an
externally-relevant stake despite being invisible outside the session. Q2 (merit vs. prioritization) —
flagged(prio) under a "both branches free to build, instantly correct" hypothetical, then resolved: that
hypothetical stipulates away the disputed omission-verification limit itself (assumes the delegate "never
omits anything"), which trivially erases the question rather than testing it. Rewrote the default's rationale
above to lead with the structural absence-claim limit (merit, holds at any budget) and demote token cost to
the already-settled secondary consideration, rather than resting the case on cost.

## Known occurrences

- **PR #1075** — the general-split language ((c) above) shipped once and was rejected twice by independent
  `security`-lens jurors on the exact grounds Fork 1 turns on.
- **`/prepare-decision-item`'s own pass 4 (skeptic) and pass 5 (screen)** — already a working, safe instance
  of *partial* delegation inside judgment work, but of the **red-team** kind, not the **draft** kind: the
  sub-agent's output is an attack or a flag that the loop independently judges against source it already has
  (exactly what happened while preparing *this* item), never a first account the loop has no independent way
  to check. That is the real distinction Fork 1 turns on — attacking a draft is safe to delegate; authoring
  the draft the loop will rule on is not.
- **This very prepare session** — the prior-art survey and Fork 1's authoring above were done fully inline
  (no sub-agent drafted the fork), i.e. Option (a) in practice for #2981 itself.

## Notes

- The verbatim carved (c)-shaped text is in PR #1075's history (`d14554a6`); the shipped doc now says
  judgment stays inline and points here.
- This decision does not need to carve a build child: (b) is recorded as *evaluated and found non-viable as
  specified*, not as a requirement queued for later engineering. If ratification affirms (a), the natural
  `codifiedIn` target is the existing anchor (`we:docs/agent/backlog-workflow.md#model-routing`) — the ruling
  confirms/hardens text already there rather than authoring new doctrine.
