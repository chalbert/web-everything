---
kind: story
size: 3
status: open
dateOpened: "2026-08-25"
tags: [backlog-hygiene, decision-cards, check-standards]
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
relatedTo: ["1935", "3118"]
---

# check:standards rule: a decision card may name exactly one default per fork

An amendment that moves a `kind: decision` card's default has to move every marker of the old one. PR #1565
moved #3118's default from (a) to (c), updated the glance table and added a `**NEW DEFAULT.**` bullet, and
left (a)'s `**DEFAULT.**` bullet and a `**Recommended default: (a).**` line standing — so the card told a
ruler two different answers depending on which line they reached first. That is mechanically detectable:
count the default markers in a decision body. Add the rule beside the #1935 dangling-residue guard
(`we:scripts/check-standards-rules.mjs:864`).

## The failure this closes

#3118 as it stood mid-#1565 carried, in one fork's bullet list:

| line | text |
| --- | --- |
| glance table | default is **(c) call the existing `dispatch-lane` operation** |
| option (a) bullet | `…No runtime dependency on plateau-app's dev server being up. **DEFAULT.**` |
| option (c) bullet | `…resumable by the waker. **NEW DEFAULT.**` |
| recommendation line | `**Recommended default: (a).** Three independent reasons converge…` |

Two bold `DEFAULT` markers on two different options, plus a recommendation line naming the displaced one.
Downstream, the card's `codifiedIn` sentence and its pre-registered jury's predicted touch-set both still
described (a)'s shape — so ratifying from the card would have codified the option the amendment displaced.

Nothing catches this today. The #1935 guard scans for *deferred*-choice prose ("TBD", "decide at
ratification"); it does not count how many answers a fork asserts. The fork-shape walks scan headings. A
review lens caught it here only because a human re-read the whole card — twice, since round 1's fix left it
standing.

## What to change

In `checkBacklogItem` (`we:scripts/check-standards-rules.mjs`), beside the existing `item.kind === 'decision'`
guard at `:864`, add a rule that, per `## Fork N` section:

- counts bullets carrying a bold default marker — `**DEFAULT.**`, `**NEW DEFAULT.**`, and the same words
  inside a `**…**` run — and flags more than one;
- reads any `**Recommended default: (x).**` line and flags it when `(x)` is not the option the glance-table
  row and the marked bullet agree on.

Skip fenced code blocks, the way the #1935 guard does.

Two things to settle while doing it:

- **Error or warning.** The #1935 neighbour warns because it is heuristic. This one is closer to
  mechanical — the markers are literal — but the fork/option parse is heuristic on a hand-written body.
  Default: **warning**, matching its neighbour, and revisit if it proves noise-free.
- **How an amendment marks a superseded default.** The rule has to leave a legible way to say "(a) *was* the
  default" — otherwise the fix is to delete the history the retraction convention exists to preserve.
  Default: a superseded marker (`**SUPERSEDED DEFAULT — see the amendment above.**`) that the counter does
  not count, so the card can keep the record and still name one live answer.

## Done when

1. **Executable** — `npx vitest run check-standards-rules` passes with a new case asserting that a
   `kind: decision` body with two `**DEFAULT.**`-marked option bullets in one `## Fork N` warns, that the
   same body with one marker and one superseded marker does not, and that a
   `**Recommended default: (a).**` line contradicting a `(c)` default warns. The new cases fail before the
   change and pass after. The existing `dangling-residue guard (#1935)` describe block
   (`we:scripts/__tests__/check-standards-rules.test.mjs:1396`) still passes.
2. `npm run check:standards` on current `main` gains no new error and no new warning from the rule — i.e.
   no existing decision card trips it, or the ones that do are fixed in the same change.
3. The two open questions above are answered in the item or in the commit that closes it.
