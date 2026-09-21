---
bornAs: xuh255e
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/lib/open-pr-items.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/lane-drain.mjs", "we:scripts/__tests__/lane-drain.test.mjs"]
dateOpened: "2026-09-21"
blockedBy: ["xggecwt"]
tags: []
---

# The drain resolves a whole multi-slice card when one slice's PR lands (#3779 slice A closed a card with four unbuilt design points)

FOUND 2026-09-21. PR #2392 built only slice A of card #3779, yet the drain then set status: resolved on the whole card because the resolve-on-land extractor (we:scripts/lib/open-pr-items.mjs) credits any lane/<NNN>-<slug> ref with item NNN and nothing checks that the card is fully built. Design-first, uncleared: the fix has a real design choice, listed with a proposed default. Do not build until the operator picks an option.

## Evidence (re-checked 2026-09-21 against main `a4ff83ea6`)

- PR #2392, head `lane/3779-handoff-location`, title "#3779 slice A: the handoff's tracked home on ops/handoff (path, pull, push)", merged 2026-09-21T17:45:51Z. Main commit `313177faf` ("drain: resolve #3779 on land (#2748)", 13:46 EDT) changed one file, the #3779 card, and set `status: resolved` and `dateResolved: "2026-09-21"`. The card's `## Done when` had four items and its design points 1, 2, 3 and 5 were unbuilt.
- Corrected since the first write-up: PR #2399 ("backlog: reopen #3779 (drain resolved it on land of slice A) and retype it to an epic") is now MERGED (2026-09-21T18:58:46Z), not open. Card #3779 is today `kind: epic`, `status: open`.
- The path, every line re-found on main today: `landedIdsForCandidate` (we:scripts/merge-ai-prs.mjs:1420, called at :4549, :4561, :4573) feeds `resolveLandedItem(process.cwd(), id, { sync: false, publish: false })` (we:scripts/merge-ai-prs.mjs:4734). That function is defined at we:scripts/lane-drain.mjs:956, runs the `resolve` verb of we:scripts/backlog.mjs (:965) and commits with the message `drain: resolve #<num> on land (#2748)` (:975). lane-drain also calls it at :457. Not verified: which of the two callers (merge-ai-prs or lane-drain) landed #2392; they share the function and the commit text, so the commit cannot tell them apart.
- WHICH SIGNAL FIRED. I ran `deliveredItemNumsFromPr` (we:scripts/lib/open-pr-items.mjs:131) on PR #2392's real inputs today:
  - ref `lane/3779-handoff-location` + title: `['3779']`
  - ref alone: `['3779']`
  - title alone: `[]`
  - ref + title + a body saying "the card stays open" + changed files including a `.mjs` file: `['3779']`

  So the rule that fired is the ref lead-segment rule (we:scripts/lib/open-pr-items.mjs:191, `/^(\d{2,5})[a-z]?$/i` on the first segment after `lane/`). The title rule (:243) needs a colon right after the id and the title reads `#3779 slice A:`, so it did not fire. Guards 6, 7 and 8 (we:scripts/lib/open-pr-items.mjs:253, :136, :141) did not fire: guard 6 matches only "does not resolve #N" and the body says "the card stays open"; guard 7 needs every changed file to be `.md` and the diff has `.mjs`; guard 8 needs a "no code changes" line and there is none.
- Nothing on the card side is checked. The `resolve` verb refuses only an epic with open child items (#658, we:scripts/backlog.mjs:305) and an undeclared presentation surface (#2803). A card's `## Done when` is prose and is not checked. Note that #3779 is an epic now but no item names it as `parent:` yet, so #658 would not stop the drain resolving it again either.
- Related, distinct: #3473 (resolved) added guards 6, 7 and 8 for a multi-PR item; all three are lexical and none covered this PR. #3441 built the extractor rules.
- How wide is the hole: only three cards on main carry a `## Slice ` heading today (#100, #2387, #3779). Most multi-PR work is not marked that way, so any fix keyed to that heading protects a narrow set.

## The design choice (needs the operator)

- **(A) Explicit marker.** A slice PR says `Refs #N` and only `Resolves #N` resolves. Needs the brief, `/pr` and `open-pr` to emit the marker. Old PRs would not carry it, so the stranded-item sweep has to catch them.
- **(B) Card-side refusal.** A card that holds a `## Slice <label>` section (or another declared marker) is never auto-resolved by the drain. The drain reports `deferred: multi-slice card` and the card is resolved deliberately. Reads the one thing that knows whether the card is fully built. Weak spot: it only works if the marker exists. In #3779's case the marker was written BY the slice PR itself (commit `b50927b78` added `## Slice A: location`), so this rule would have caught it, but a first slice PR that does not add the heading is not protected.
- **(C) Run the card's Done-when at land time.** Not feasible today: the items are prose, not runnable commands, and are not checkbox-marked, so "unchecked Done-when" has no machine-readable form.
- **(D) More lexical guards on the PR title and body** (`slice A`, "stays open"). Eight rounds of this already went into #3441 and #3473 and each catches the last miss only. Fragile.

**Proposed default: (B),** with (A) later as an additive backstop. It needs no convention change, it reads the card, and it fails in the safe direction: a false skip strands an item that the stranded sweep finds, while a false resolve silently closes unbuilt work. Open sub-question for the operator under (B): is the `## Slice ` heading the only marker, or does the card also need a frontmatter field so a slice PR cannot forget it?

## Done when

Written for the proposed default (B); if the operator picks another option, this section is rewritten before the card is built.

1. **Executable** — `npx vitest run lane-drain -t 'multi-slice'` passes. The new case builds a temp git repo holding a card with `## Slice A: location` and `status: open`, calls `resolveLandedItem` (we:scripts/lane-drain.mjs:956) on it, and asserts it returns `flipped: false` with `reason: 'multi-slice'` and leaves the card file byte-for-byte unchanged. A sibling case with the same card minus the Slice section still flips it to `resolved`. Fails today: the function has no such reason, and the first case flips the card.
2. **Executable** — the same suite has a case that runs `deliveredItemNumsFromPr` on PR #2392's real ref and title and still returns `['3779']` (the extractor is unchanged; the refusal lives on the card side), so the fix cannot be met by editing the extractor alone.
3. **Executable** — `npm run check:standards` reports 0 errors.
