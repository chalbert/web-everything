---
bornAs: xhhsfnq
kind: task
status: open
dateOpened: "2026-08-20"
tags: []
---

# Give suggest-next a scope so a caller can ask about one epic, tag or locus

suggest-next answers what is next over the whole board and nothing else, so any narrower question fell back to hand-rolling: check readiness select, then grep parent across the backlog, then read cards. That is a second read of the board and it is how two views of it drift apart. Three optional narrowers over the same ranking close it. A filter is never a second ordering, and a scope that matches nothing is reported as an empty scope rather than widened back to the unscoped list.



## The hand-rolling it closes

Asked to propose a next big slice, I ran `check:readiness --select`, then grepped `parent:` across
`we:backlog/`, then read six cards by hand — reconstructing by eye what the ranked board already knew.
`suggest-next` was right there and could not answer the question, because its only inputs were `tier`,
`limit`, `batchableOnly` and `scanOpenPrs`.

That is the same defect `open-pr` (#3209) exists to stop, one layer up: a declared operation covering the
step, and a caller reaching around it because the operation could not express what they wanted.

## A filter is not a second ranking

The load-bearing design rule. "Which items am I asking about" and "which of them matters most" are
different questions, and the second already has exactly one owner — `computeSelection` in
`we:scripts/readiness/engine.mjs`. So `applyScope` **only removes**, never reorders, and the survivors come
out as the same objects in the same order. A scope that re-sorted (surfacing an epic's blockers first, say)
would be a second ordering living inside a filter, and the two would drift apart — the class #2644 makes
these singular to prevent.

Three narrowers, ANDed, each optional:

- `--parent=NNN` — items under one epic, compared on the PADDED number, because the loader stores the
  frontmatter string (`"2405"`) while a caller naturally types `2405`;
- `--tag=` — case-insensitive against the loader's own `tags`, so it cannot disagree with the board;
- `--locus=` — one gate home.

## An empty scope is not an empty pool

The existing legible-empty block (#083) already distinguishes three reasons a pool can be empty. A scope
that matched nothing is a **fourth**, checked first, and it is never widened back to the unscoped list —
answering a question the caller did not ask is the same defect as reporting a check that did not run as a
pass. `scopedOut` reports how many ranked items the scope removed, which separates "this epic has nothing
ready" from "that scope matches nothing at all".

Proven on the real board: `--parent=99999` returns nothing and says *"the pool is NOT empty, your scope
is."*

## The projection had to carry two more fields

`computeSelection`'s `project` is an explicit whitelist, and it dropped `parent` and `tags` — so the first
cut of the filter matched nothing on a live board even though six qualifying items existed. Both are now
projected, for the same reason `locus` already was: they are facts the loader derived, and a consumer that
has to re-read the backlog to recover them is taking a second read of the board.

## Done when

1. **Executable** — `npx vitest run` over `we:scripts/operations/__tests__/suggest-next.test.mjs` passes 27
   assertions. Making the scope re-sort reddens 5; widening an empty scope back to the unscoped list
   reddens 1; making the tag match case-sensitive reddens 1.
2. **Proven on the live board** — `suggest-next --parent=2405` returns the six open children of that epic,
   in the board's own order, with no grep.
3. **Derived** — the three flags appear in `--help` and in the HTTP describe route with no argv code
   written for them.
