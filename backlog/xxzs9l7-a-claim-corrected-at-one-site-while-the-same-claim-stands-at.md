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
That is exact-comparable and is filed separately as "A PR body's frontmatter claims are never checked against
the diff it describes". This item takes the fuzzy prose half only, and its output is advisory for that
reason.

## Done when

1. **Executable** — a check that, given PR #1560's r3→r4 diff, warns and names *Not in scope* as still
   carrying the `3c–3e` range that *Tasks* 3 was corrected to drop.
2. **Mutation** — correcting the surviving site in the fixture silences the warning; re-introducing it in a
   third file raises it again there. The check must key on the *surviving* copy, not on the edited one.
3. It reads the PR body alongside the lane's changed markdown, so the r4→r5 instance is in range.
4. It emits a warning and never fails the gate — verified by a fixture that warns while the run still exits
   0.
5. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
