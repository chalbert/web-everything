---
kind: story
size: 3
parent: "3029"
status: open
relatedTo: ["3238"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [prevention, gate, backlog, batching]
---

# A same-count marker swap reads as no change, because only the aggregate warning total is compared

An edit that removes one non-batchable marker from a card and introduces another leaves the warning total flat, and "unchanged from baseline" is how every PR body reports the gate. The per-item marker set is already computable — `findNonBatchableMarkers` returns `{ line, marker }` per hit — but nothing diffs it between base and head. Prevention owed by a CONFIRMED finding on PR #1556, where the marker on `#3238` moved rather than went away and the total never moved. Ground truth is two sets, not two integers.

## Why the total cannot see this, by construction

This is not a sampling gap that a more careful reading of the output would close.
`we:scripts/check-standards-rules.mjs:812` collects every marker hit on an item and then pushes **one**
warning for the item, with the distinct markers and lines interpolated into the message:

> `const markers = [...new Set(markerHits.map((h) => h.marker))].join('", "');`

So an item with one marker and the same item with four produce **one** warning either way. The aggregate at
`we:scripts/check-standards.mjs:2373` is a count of warnings, so a swap inside one item is invisible to it
*even in principle* — and so is a swap across two items, since one leaves and one arrives.

Measured on the real case rather than argued. Running `findNonBatchableMarkers` over
`backlog/3238-…md` on this lane's `main` and over the same file at PR #1556's head (`5289202`) — the marker
sets are fenced below because this card would otherwise trip the very lint it is about:

```text
main            [{"line":4,"marker":"unverified prerequisite"}]
PR #1556 head   [{"line":21,"marker":"unverified prerequisite"},
                 {"line":36,"marker":"not batchable"},
                 {"line":39,"marker":"unverified prerequisite"},
                 {"line":121,"marker":"unverified prerequisite"}]
```

One warning on each side. The set turned over completely; the number a body would quote did not move.

## What it must not do

**It must not become a second scanner.** The hits come from `findNonBatchableMarkers` and nowhere else. A
private re-scan would drift from the rule it is supposed to be reporting on, and then the diff would be
between two different definitions of "marker" rather than between two trees.

**It must not report a moved line as a new marker.** A card edited above the marker shifts every line below
it. Keying the set on `(item, marker)` and reporting the line as detail — rather than keying on
`(item, marker, line)` — keeps an unrelated insertion from reddening the check. This is the one design call
the owed text does not settle: it names `(item, marker, line)` as the key, and a line-keyed set would fire on
every edit above a marker. Key on `(item, marker)`; carry the line.

**It must not need the gate to run twice by itself.** The comparison is a pure function of two marker maps.
Producing the two maps — one per tree — is the caller's job, and `--json`
(`we:scripts/check-standards.mjs:103`) already exists for exactly that.

## Interfaces

A pure function in `we:scripts/check-standards-rules.mjs` over two `Map<itemId, Set<marker>>`, returning
`{ added, removed }` with the lines carried as detail. No filesystem, no git, no network.

## Done when

1. **Executable** — the two marker sets fenced above, base against head, report exactly the markers `#3238`
   gained and nothing removed. That pair is the real file either side of PR #1556, measured, not constructed.
2. **Executable** — a swap that leaves the count flat is still reported: base `{A: [x]}` against head
   `{B: [x]}` reports one removal on `A` and one addition on `B`. This is the case the aggregate cannot see
   and the whole reason for the item.
3. **Executable** — the same marker on the same item at a different **line** reports nothing. An edit above a
   marker must not redden the check.
4. **Executable** — identical maps report nothing, and an item present in only one tree (a card added or
   deleted by the diff) is reported as added/removed rather than throwing.
5. **Mutation** — keying the set on the line as well as the marker reddens case 3 by name; comparing set
   *sizes* instead of set *contents* reddens case 2 and nothing else.
6. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
