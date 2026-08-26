---
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/pr-land.mjs
tags: []
---

# A producer review label can be scored on the base-tip fallback basis

When `resolveNetDiffBasis`'s merge-base lookup fails it silently falls back to the base TIP, so a branch merely BEHIND main is scored on other people's changes — and the false review:human that results is clearable only by a human ceremony.

## What this card first claimed, and why that was wrong

The first version of this card was titled *"A producer review label is decided on the inflated three-dot
basis"* and opened:

> pr-land derives the review label from GitHub's three-dot file list, so a branch merely BEHIND main is
> labelled from other people's changes

It went on to say that *"GitHub's three-dot diff attributes such a file to the PR"*, and, under a heading *"The
fix is already half-built elsewhere"*, that

> The producer-side label derivation in `we:scripts/pr-land.mjs` did not get the same treatment.

**All of that is false, and the last sentence is the exact opposite of the code.** Verified by reading the
source in this lane:

- `we:scripts/pr-land.mjs:839` scores the label off `computeNetDiffSignals({ exec, remote, base, baseRev, rev:
  refSha })` — a LOCAL git computation. The only `gh` call in that whole block is `gh pr view --json labels`
  at `we:scripts/pr-land.mjs:855`. There is no `gh pr diff` and no `--json files` read anywhere in this path.
- `resolveNetDiffBasis` (`we:scripts/merge-ai-prs.mjs:2060`) **already** narrows the left side of the diff to
  `merge-base(origin/main, head)` for precisely this scenario. Its own comment at
  `we:scripts/merge-ai-prs.mjs:2082` names it: *"a head that's behind an advanced base would otherwise have
  every upstream-only commit swept in as if the PR touched it"* (#2404). There is a named regression test at
  `we:scripts/__tests__/merge-ai-prs.test.mjs:1460`.
- The statute term inside `scoreEscalation` reads that merge-base-narrowed basis, not any GitHub file list:
  `gateBasis` comes from `humanBasisFiles` at `we:scripts/lib/review-escalation.mjs:568`, and `statuteFiles`
  filters it at `we:scripts/lib/review-escalation.mjs:571`.
- The `gh pr view --json files` read the retracted text described exists ONLY in the drain's separate no-clone
  fallback, `we:scripts/merge-ai-prs.mjs:3298` — and the drain did not apply this label. #1595's timeline is
  `ready-to-merge` → `review:human` → `ready-to-merge` stripped within six seconds of open, the producer
  sequence.

The cost of leaving that framing standing is concrete: a builder greps `we:scripts/pr-land.mjs` for a
three-dot read, finds the #2404 narrowing plus its regression test, and either resolves this item as
already-fixed — leaving a reproduced mislabel unfixed — or "fixes" the hardened path.

## The symptom is real — reproduced in this lane

PR #1595 added **three backlog cards and nothing else**. It opened labelled `review:human`, reason
*"blast-radius (…platform-decisions…); statute (…platform-decisions…) — human review required"*. It touches no
statute file.

Rebuilding that pre-rebase head — `08953e25`'s tree plus the three cards from `3dcd4e7f` — and diffing it both
ways against a pinned main tip (`7ef6d9e4`):

| left side of the diff | files reported |
| --- | --- |
| `merge-base(main, head)` = `08953e25` — what #2404 does | **3** — the three cards, no statute file |
| `main` tip = `7ef6d9e4` — the fallback | **12**, including `we:docs/agent/platform-decisions.md` |

That file is a statute path — `STATUTE_PATHS` at `we:scripts/lib/review-escalation.mjs:70`.
Any statute touch forces `humanRequired` at `we:scripts/lib/review-escalation.mjs:574`.
So the inflated basis — and **only** the inflated basis — reproduces the label that actually fired.

## The real mechanism

Inside the #2404 narrowing, the fallback is silent:

```js
let diffBase = baseRef;
try {
  const mb = String(exec('git', ['merge-base', '--end-of-options', baseRef, candidate], …) || '')
    .split('\n')[0].trim();
  if (mb) diffBase = mb;
} catch (err) {
  if (isExecContractError(err)) return { ok: false, reason: 'exec-contract', requestedFor };
  /* no common history, or candidate doesn't resolve yet — the diff below is the real probe */
}
```

When `git merge-base` throws or prints nothing, `diffBase` stays at `origin/main` — the base **tip** — and the
whole narrowing is skipped. The `git diff` right after still succeeds, so the basis returns `ok: true` and
nothing downstream can distinguish an over-inflated basis from a narrowed one.

The existing test for that path calls it *"the prior, safe over-scoring behavior, never a scoring failure"*
(`we:scripts/__tests__/merge-ai-prs.test.mjs:1489`). Over-scoring is safe for SIZE and blast-radius, which cost
a review round. It is **not** safe for the human gate, which is one-way (below). That asymmetry is the bug.

**Both ends of that asymmetry are in `scope:`.** The basis has to report that its merge-base lookup failed
(`resolveNetDiffBasis`, `we:scripts/merge-ai-prs.mjs:2060`), and the human gate has to refuse to score on such
a basis — `humanRequired` is computed at `we:scripts/lib/review-escalation.mjs:574`, so
`we:scripts/lib/review-escalation.mjs` is named in `scope:` alongside the producer that threads the two
(`we:scripts/pr-land.mjs:839`). The first version of this card scoped only `we:scripts/merge-ai-prs.mjs` and
`we:scripts/pr-land.mjs`, which named the symptom's path but not the gate that has to change.

**What is NOT established:** why the merge-base lookup failed for #1595 specifically. Establish that before
building — the diagnosis is what this card still owes. Candidates worth checking first, in order:

1. A shallow lane clone with no common history reaching back to the fork point.
2. A swallowed `git fetch` failure in the same function leaving `origin/main` stale or absent — the catch
   above it degrades to "whatever is locally cached" without saying so.
3. The candidate list — `origin/<rev>` first, then the bare `rev` — resolving its first entry to something
   unexpected.

## Why the stickiness is the expensive half

A wrong `review:pending` costs a review round. A wrong `review:human` costs **a person**, and it is
deliberately one-way: `decideSetLabel` refuses `accepted` on a `review:human` PR (INVARIANT 2), and the only
thing that removes the label is the human ceremony — an operator instruction, quoted verbatim, on a named PR.

That fail-closed design is right for a real statute edit and exactly wrong for a basis error. The recovery used
on #1595 was to **close it and reopen from the same rebased commit**, which is cheap but leaves a closed PR in
the record and works only because the mistake was caught immediately.

Independently of the basis fix, the second half is worth its own thought: **should a label derived at open be
re-derived when the head moves?** A rebase that removes the triggering file currently leaves the verdict of the
old basis in place.

## The #3317 overlap, re-checked

The first version of this card said *"Check whether that already closes this before building anything… If
#3317 covers it, resolve this as `graduatedTo` rather than duplicating."* **Re-checked against the corrected
framing: it does not cover it.** [#3317](/backlog/3317/) widens `changedFiles`/`diffLines` to a cumulative
merge-base measurement because only `humanBasisFiles` is forced cumulative today — the opposite direction from
this card, and it does not touch the merge-base-fails fallback at all. Build this on its own.

## Done when

1. **Executable** — a test asserting that a branch which is behind `main` and touches no statute file does
   **not** earn `review:human`, and that one which genuinely edits a statute file still does. Both directions:
   a rule that stops firing is worse than one that over-fires.
2. **Executable** — a test asserting that a basis whose merge-base lookup FAILED is distinguishable from one
   that succeeded, so the human gate can refuse to score on it (the size terms may keep over-scoring).
3. `npm run check:standards` — 0 errors.
