---
bornAs: x1l3exg
kind: task
status: resolved
dateOpened: "2026-09-06"
dateResolved: "2026-09-06"
graduatedTo: none
tags: []
---

# A landed backlog item kept its in-flight hash id because the drain only JIT-numbers manifest-carrying PRs

`we:backlog/3502-a-card-resolve-pr-can-land-before-the-impl-it-names-in-gradu.md` is on `main` with a hash
id. `we:docs/agent/backlog-workflow.md` says a hash-prefixed file is in-flight and a numeric one has landed,
so a landed hash-keyed card contradicts a documented invariant — its short ref and URL stay provisional
forever. The drain's JIT numbering (#2288) runs off the couple manifest, and a hand-opened PR carries none.

## WITHDRAWN — the premise was false (2026-09-06)

**JIT numbering does run for a hand-opened PR. It just runs in a LATER drain pass, not synchronously with
the merge**, and this item was filed from a snapshot taken in that window.

The proof is this card itself. It was filed as `x1l3exg` and is now `#3503`; the item it was filed *about*
was `xlv5507` and is now `#3502` — and the drain rewrote the reference in this very body from the hash to the
number, exactly as `we:docs/agent/backlog-workflow.md` describes. The landing commit says so outright:

> `drain: JIT-number x1l3exg→#3503, x45zcv4→#3504, … at land (#2288)`

So there is no invariant violation to gate. A hash-keyed file on `main` is not a landed item that missed its
number — it is an item observed between its merge and the numbering pass. The stated cause ("JIT numbering
runs off the couple manifest, and a hand-opened PR carries none") is simply wrong: the numbering pass keys on
the landed files, not the manifest.

Resolved as withdrawn rather than deleted, so the reasoning is on the record and the next reader does not
re-file it from the same misleading snapshot.

**What stays true, and is filed elsewhere:** the *ordering* and *graduation* gaps a hand-opened PR really
does expose are `#3502` (a card-resolve can land before the impl it names) and `#xgmzd0y` (review-pr cannot
judge a sibling repo). Neither depends on this item's false premise.

## Original acceptance criteria (superseded)

1. **Executable** — a check that fails on a landed (on `main`) `we:backlog/` file whose id is still the
   `xNNNNNN` hash form. Red against the current tree while `3502` remains hash-keyed, green once numbered.
2. The existing item is numbered, or the rule that lets it stay hash-keyed is written down where the
   backlog-workflow doc currently asserts the opposite.

The invariant is already stated in `we:docs/agent/backlog-workflow.md` — *a hash-prefixed file is an in-flight
item that hasn't landed yet; a numeric one has landed* — so today's tree contradicts a documented rule.
