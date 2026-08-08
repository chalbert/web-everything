---
bornAs: xm1fefh
kind: decision
parent: "1855"
status: open
dateOpened: "2026-08-07"
tags: []
---

# Can judgment work split into a delegated draft half and an inline call half, and what grounds the call?

Delegate-by-default (#1855, PR #1075) inverted execution routing but deliberately left judgment work —
selection, the decision arc, slicing/splitting, preparing a fork — inline. A stronger claim was drafted
into that PR and **carved back out**: that each of these splits, with the *work* half (survey prior art,
draft the fork's options, draft the slice breakdown) going to an Opus sub-agent and only the *call* half
staying on the loop. It is attractive — `/prepare-decision-item` is arguably already that shape — but the
grounding story does not hold, so it needs a ruling rather than a paragraph.

## The fork

**Option A — keep judgment fully inline** (status quo, and what PR #1075 shipped). The superseded rule was
explicit: *"Keep it on the Opus loop when the work itself is judgment (`decision`/slice/prepare)"* and
*"Judgment turns are never spawned this way."* Cost: the loop pays full context for every survey and draft.

**Option B — split it, with a stated grounding rule.** Delegate the drafting, keep the call, and name what
the loop must independently read before ruling.

## Why the drafted version failed review

Two `security` jurors, independently, on the PR #1075 convergence panel:

- **Row 2 cannot ground it.** The inline/spawn table justifies keeping the call inline by requiring the loop
  to *"open the artifact it rules on… not only a sub-agent's account of it"*, because *"a summary cannot show
  what it left out"*. For a `decision`/`slice`/`prepare` the artifact **is** the sub-agent's writeup — the very
  thing row 2 disqualifies. The same section bans reading source *to learn*, so nothing else is available to
  ground against. The loop would rule on the proposal using the proposal as its evidence.
- **The blast-radius axis was dropped.** The superseded Sonnet gate required *"blast radius is bounded (single
  locus, touches no contract / shared gate / cross-repo seam)"*. That bullet was doing two jobs — deciding who
  rules **and** guaranteeing the ruler had context. The rewrite kept the first and lost the second, so the
  highest-blast-radius class now gets a verdict formed on diff text alone.

## What a passing Option B needs

- An explicit read carve-out: when the artifact under verdict was authored by the same sub-agent, the loop
  independently opens the concrete `file:line` refs the fork or slice cites before ruling.
- The same for a shared gate, guard hook, contract or cross-repo seam — the loop may read the surrounding
  code and tests it needs to rule; *too big to read* stays a split signal, never a licence to skip.
- A deterministic backstop worth checking: `check:health` G4 (false-prepared-fork) and D1 (dead `file:line`
  refs) already exist. Binding them to the delegated path as a required pre-ratification run would make the
  grounding machine-checkable instead of remembered.

## Notes

- Carried out of PR #1075 rather than settled inside it — the shape #2950 prescribes for a finding that
  introduces a new goal instead of serving the item's stated one.
- The verbatim carved text is in that PR's history; the reframe now says judgment stays inline and points here.
- Ruling here should also decide whether `/prepare-decision-item` is the sanctioned exception or the general case.
