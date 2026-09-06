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

## WITHDRAWN as a duplicate of #2319 — but the STATED CAUSE was wrong (2026-09-06)

Two corrections, in the order I got them wrong.

**First: the numbering usually does run, and I filed from a snapshot inside the window where it had not yet.**
This card was `3503` and is now `#3503`; its subject was `3502` and is now `#3502`; the drain rewrote
the reference in this very body. The landing commit says so: `drain: JIT-number 3503→#3503, 3504→#3504,
… at land (#2288)`. So "a hand-opened PR is never numbered" is false.

**Second — and this is where my first correction over-swung: a stranded hash is a REAL failure, already
tracked, and already gated.** `check:standards` errors on it in as many words:

> Backlog file … is on main with a NON-NUMERIC leading id — a land route bypassed JIT numbering (#2288) and
> stranded a hash (#2319). Number it: `node we:scripts/backlog.mjs number-stranded`

It fired on `3512` the moment that item landed. The repair works — running it numbers the file — but it
is a **main-side** repair: run from a branch it strands the tree between two other rules (the hash is still
on `origin/main`, and the fresh `NNN` reads as hand-picked, #2548), so the operator or the drain runs it on
`main`. So the phenomenon this card describes exists; what this card got wrong was its cause ("JIT numbering
runs off the couple manifest") and its premise that nothing catches it.

Withdrawn as a **duplicate of #2319**, which owns the class with a working repair, rather than as a
non-issue. The honest summary: a land route can strand a hash, the gate catches it, and the fix is one
command — none of which needed a new item.

## Original acceptance criteria (superseded)

1. **Executable** — a check that fails on a landed (on `main`) `we:backlog/` file whose id is still the
   `xNNNNNN` hash form. Red against the current tree while `3502` remains hash-keyed, green once numbered.
2. The existing item is numbered, or the rule that lets it stay hash-keyed is written down where the
   backlog-workflow doc currently asserts the opposite.

The invariant is already stated in `we:docs/agent/backlog-workflow.md` — *a hash-prefixed file is an in-flight
item that hasn't landed yet; a numeric one has landed* — so today's tree contradicts a documented rule.
