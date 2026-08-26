---
bornAs: x7jlumy
kind: story
size: 3
status: open
dateOpened: "2026-08-26"
relatedTo: ["2899", "2748", "2906"]
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/lane-drain.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
tags: [drain, backlog-state, resolve-on-land, silent-failure]
---

# resolve-on-land did not fire: five items stayed open after their PRs merged

On 2026-08-26, five items had their implementing PRs merged to `origin/main` and all five were still
`status: open` (one `active`) hours later. That is the exact #2899 failure shape the resolve-on-land flip was
built to end, recurring three weeks after it was fixed. **This card records the observation and its evidence.
It deliberately does not diagnose or fix the mechanism** — it was filed by a bookkeeping-reconciliation pass
whose scope was `backlog/*.md` only.

## The five, each verified against `origin/main`

| item | PR | merge commit | merged (UTC) | card status when found |
| --- | --- | --- | --- | --- |
| #3317 | #1592 | `89812fd5` | 2026-08-26 20:24:58 | `open` |
| #3322 | #1594 | `9f9cb310` | 2026-08-26 20:25:03 | `active` |
| #3319 | #1585 | `5a1d82b9` | 2026-08-26 21:37:24 | `open` |
| #3309 | #1601 | `239aec29` | 2026-08-26 22:00:57 | `open` |
| #3316 | #1602 | `f4160eaa` | 2026-08-26 22:01:01 | `open` |

Every merge commit is an ancestor of `origin/main` (`git merge-base --is-ancestor <sha> origin/main`), and each
PR's diff carries the real implementation, not just a card edit — for example #1592 changed
`we:scripts/lib/review-escalation.mjs` (+89/−19 across the diff) and #1601 changed
`we:scripts/lib/decision-routing.mjs` (+269). So this is not a case of cards resolving ahead of the work.

Each PR body opens with a `Resolves #NNNN` / `Closes #NNNN` line, and each PR's diff **does** touch its own
card — but only to extend the body. None of the five flipped `status:`. So the producer did not pre-author the
resolve, and nothing flipped it at land either.

## Why this matters, in the words of the item that already fixed it once

#2899 (RESOLVED 2026-08-03) records the cost precisely: an item in this state is **permanently** eligible.
It never resolves on its own, so every future batch that packs by leverage re-selects it, and *"the cost per
re-pack is a full item cycle, paid by whoever draws it next, in a fresh context with no reason to suspect the
work is done."* Two of three items in one batch were in exactly this state when #2899 was filed. Five in one
day is a larger sample than the one that justified building the flip.

Closing these five by hand cost one lane, one reconciliation pass and one PR — to change five frontmatter
lines.

## Leads, offered as leads and not as a diagnosis

Recorded so whoever picks this up does not re-derive them, and explicitly **not** verified as the cause:

- The label lander's resolve pass reads its work set from `landedThisPass`, and every one of the three sites
  that populates that set is gated on `c.hasManifest && c.item != null`
  (`we:scripts/merge-ai-prs.mjs`, the `landedThisPass.add(asItemId(c.item))` lines). A landed PR whose verdict
  carries no couple manifest — or carries one with no `item` — therefore never enters the set, and
  `planResolveOnLand` never sees it. Worth checking first whether these five verdicts had a manifest at land.
- `planResolveOnLand` also **defers** an item whose couple has a sibling head-ref still open. A deferral is
  terminal for the run by design (#2906), and the drain prints it on stderr. Whether any of these five were
  deferred rather than skipped is answerable from the drain's own output, which was not captured here.
- `we:scripts/backlog-stranded-sweep.mjs` is the documented recovery path for exactly this. Whether it is being
  run at all is a separate question from whether the flip fires.

## Prior art — read these before proposing a fix

- **#2899** — *"JIT-numbering at land leaves a delivered item open"*. Its corrected root-cause section is the
  one to read: the two landers shared the **numbering** and not the **resolving**, and the fix single-sourced
  `resolveLandedItem` into both. If this recurrence has a different cause, that section is the template for
  recording it.
- **#2748** — put on-land cleanup (lease release + card flip) on the drain's terminal land event.
- **#2906** (OPEN) — the totality gate: a step that withholds work from a merge decision must report what it
  withheld. Directly relevant, because *"a silent withhold is indistinguishable from having had no work to do"*
  is precisely why this recurrence was invisible until a human counted open cards.

## Done when

1. **Reproduced or refuted.** A named test in `we:scripts/__tests__/merge-ai-prs.test.mjs` fixes the actual
   land-time inputs for one of the five PRs above and asserts whether its item reaches
   `planResolveOnLand`'s `resolve` bucket. Whichever way it comes out, the answer is pinned rather than
   remembered.
2. **The observation is closed with a stated cause**, recorded on this card the way #2899 records its
   correction — including the case where the mechanism was fine and something upstream (a missing manifest, a
   land route that bypasses the pass) is at fault.
3. `npm run check:standards` — 0 errors.
