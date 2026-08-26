---
kind: story
size: 3
status: open
relatedTo: ["3147", "3035"]
dateOpened: "2026-08-25"
tags: [operations, review, prevention]
---

# A claim corrected at one site while the same claim stands at another has no gate

Sweep a lane's changed markdown for a claim that was edited in one place and left standing verbatim in another, so a half-applied correction is caught before review.

## The observation this is filed from

PR #1560 (preparing #3147) was bounced four rounds, and the recurring shape was not "a wrong claim" — it was
**a wrong claim fixed once and left standing elsewhere**:

| round | fixed at | left standing at |
| --- | --- | --- |
| r2→r3 | *Done when* 1 — the `grep -rl "dispatch-lane"` count | the opening paragraph, still saying it "returns nothing" |
| r3→r4 | *Tasks* 3 — the spawn-site enumeration | *Not in scope*, still naming a `3c–3e` range and "panel spawns" |
| r4→r5 | the PR body's `scope:` sentence | the PR body's `blockedBy` sentence, three paragraphs above |

In every case the *corrected* site was the one the review quoted, and the surviving site was one the review
had not quoted yet — so the next round's reviewer found the same claim again and bounced it again. Round 4's
commit message was literally *"fix the SOURCE of the bad claims, not one more copy of them"*, and it still
left one copy standing. That is the case for a gate rather than more care.

## The check

When a lane's diff **removes or rewrites** a distinctive sentence or literal from a markdown file, and a
near-identical string is still present in the post-image of that file — or of any other markdown file the
same lane changed, or of the PR body — that is a half-applied correction. Report the surviving site with
both strings.

Deliberately a **warning, not an error**, and deliberately shingled rather than exact: some repetition is
intentional (a card that states a criterion and then restates it as a *Done when*), so this must surface a
site for a human to look at, not refuse a push. The value is that the surviving copy is *named*; the cost of
a false positive is one glance.

## Where it plugs in

`we:scripts/check-backlog-item.mjs` already runs per-item on edit and shares its detection with the
whole-repo gate, but it reads one file's post-image and cannot see a *removal*. This check needs the diff —
so it belongs beside the existing lane-diff passes, not inside the per-file lint, and it must read the PR
body as one more "changed markdown file" since that is where the r4→r5 instance lived.

## Not in scope

The mechanically-decidable `key: value` half — a body span quoting a frontmatter value its diff contradicts.
That is exact-comparable and is filed separately as `xaemgqd`, "A PR body's frontmatter claims are never
checked against the diff it describes". This item takes the fuzzy prose half only, and its output is advisory
for that reason.

A **newly written** claim that is wrong on its own terms — no earlier site to compare against, so a
survivor-detector cannot see it. The instance that bounced #1560's round 5 was a *Done when* criterion naming
a fixture whose stated exit code it never ran, and round 6 added a quoted `grep` whose stated file count was
falsified by the commit that wrote it; that is the third sibling in this family, filed as `x6uyq86`, "A
quoted invocation ships with a result nobody re-ran".

A claim that was **true when written and falsified behind the lane**, when a concurrent lane amends the item
it cites. No site changed, so there is nothing for a survivor-detector to compare; the check has to re-read
the cited item at the target `main`. That is the fourth sibling, filed as `xeh31dn`, "A card's prose claim
about another item's current content is never re-read when that item is amended".

A citation whose **text** never changed and whose **address** did — a `line N` pointer moved by a later hunk
in the same lane. Nothing was corrected, so a survivor-detector has no pair to compare; the number simply
stopped resolving to the sentence. That is the fifth sibling, filed as `xfw8svt`, "A `file:line` citation
goes stale because a later hunk in the same lane shifts the line it points at".

## Done when

1. **Executable** — a check that, given PR #1560's r3→r4 diff, warns and names *Not in scope* as still
   carrying the `3c–3e` range that *Tasks* 3 was corrected to drop.
2. **Mutation** — correcting the surviving site in the fixture silences the warning; re-introducing it in a
   third file raises it again there. The check must key on the *surviving* copy, not on the edited one.
3. It reads the PR body alongside the lane's changed markdown, so the r4→r5 instance is in range.
4. It emits a warning and never fails the gate — verified by a fixture that warns while the run still exits
   0.
5. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
