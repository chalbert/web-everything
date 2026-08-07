---
bornAs: xztipiw
kind: story
size: 5
status: resolved
scaffoldedBy: "converge-skill"
dateScaffolded: "2026-08-06"
blockedBy: ["2965"]
dateOpened: "2026-08-06"
graduatedTo: the /converge skill and its working-tree transport
dateResolved: "2026-08-06"
tags: []
---

# /converge — run the real convergence loop on working-tree work before a PR exists

The conveyor's converge-before-PR step is PROSE in we:skills-src/conveyor/delivery-agent-brief.md — hand-run, no round cap, no panel reduction, no ledger. Give it the real bounded loop: a two-member transport contract (readMaterial, applyRevision) with a working-tree implementation (git diff vs the lane fork point; the editor edits files in place, no push), plus a thin /converge skill in we:skills-src/converge/ driving the extracted core. ADVISORY ONLY — it reports a verdict and never blocks opening a PR. Judging (roster, weighting, reduction) stays entirely in we:scripts/lib/jury-core.mjs.

## The transport contract — exactly two members

`readMaterial` and `applyRevision`. Nothing else. An earlier draft also hoisted `snapshot` / `checkpoint` /
`restore` / `allowedWriteSet` onto the shared contract; a jury flagged that as premature generalization —
four shared concepts sized for a third caller that does not exist, and stubs on the `pr-branch` side. Round-
boundary bookkeeping stays private to whichever transport actually needs it.

- **`working-tree`** (this item) — reads `git diff` against the lane's fork point; the editor edits files in
  place. No commit, no push.
- **`pr-branch`** (exists today, migrates later under the follow-on item) — reads the net PR diff, pushes the
  revision to the PR head.

## Advisory, deliberately

`/converge` reports a verdict and a ledger. It does **not** gate opening a PR. A draft of this design grew a
refusal in we:scripts/pr-land.mjs keyed on a snapshot sha; the jury found it both unimplementable as written
(it compared a synthetic commit sha to a pushed tree) and unscoped — it would have blocked every lane with no
convergence record, including drain lanes, doc-only lanes, and the PR shipping this feature. Whether
convergence should ever gate PR-open is a separate decision, not this item.

The improvement over the prose brief is **boundedness**, not enforcement: a coded loop with a round cap, a
real panel reduction, and a ledger, instead of instructions a model follows by hand.

## Open question — the care floor → **carried out to #2954**

`working-tree` material has no escalation reasons, so the care dial has no signal and would fall to baseline —
the lowest rigor, on work nothing has judged yet. Deriving care from the touch-set (as the subject adapters
already do for lens selection) is the likely answer, but it needs its own call before this ships at anything
above advisory.

**This question is NOT closed by this item's resolution.** It lives on as **#2954** (derive the care level for
working-tree convergence from the touch-set), because a resolved item drops out of `check:readiness` selection
and off the burndown — an open question left inside a closing artifact reads as disclosed while being
unreachable. The interim mitigation shipped in PR #1064's review fixes: the CLI's default band is `elevated`
(the weakest band at which an editor round can happen at all), and `--jurors` / `--round-cap` can only RAISE
rigor, never lower it.

## What this item did NOT deliver — **#2969**

`graduatedTo` above records where the CODE went. It does **not** mean the named consumer was connected:
`we:skills-src/conveyor/delivery-agent-brief.md` step 6 — the prose loop this item's problem statement names —
is unchanged, and `#2970` covers only `we:scripts/workflows/review-parked-prs.mjs`. `/converge` therefore
ships with zero production callers. **#2969** is the wiring item.
