---
bornAs: x1y4g3j
kind: story
size: 3
parent: "3029"
status: open
blockedBy: ["3032"]
dateOpened: "2026-08-08"
scope:
  - we:scripts/operations/
scopeRationale: "Adds one declaration file to the new operations directory; the exact filename does not exist yet."
tags: [plateau-loop, delivery, operations, decision, ratify]
---

# Declare ratify — the do-effects-generalise test

Ratifying a decision is **human-only by nature**, and its effect is unlike every other operation's: it writes
repository files — the item's frontmatter and body, and usually a statute section — through a branch and a pull
request, rather than calling the forge API on an existing one.

## What it probes

The `record` step of [#3035] emits comment / label / ledger / event — all forge calls. If the effect executor
has quietly grown up assuming that shape, this is where it shows. **An effect whose application is "open a PR and
wait" must fit the same executor, keyed the same way, or the abstraction is thinner than it looks.**

The idempotency question is the sharp one and is worth stating up front: replaying a forge comment is a
no-op-or-duplicate problem, but replaying a branch-and-PR effect must not open a second PR. Whatever the executor
does about that generalises to every future file-writing operation, so it is worth getting right on the third
conversion rather than the tenth.

## Also probes the confirm actor field

Per the ruling, `confirm` is **one kind with an actor field** rather than two kinds. Ratification is the strictest
human-only case on the board, so it is the natural place to prove the field carries its weight — and that a guard
in the pure core, not a separate step kind, is what makes the restriction unbypassable.

## Acceptance

`ratify` runs through the declared operation. A ruling recorded through it produces the same on-disk result as one
recorded by hand today — status, dates, `codifiedIn`, the statute section — and it lands through the normal lane →
PR transport, never a direct write. Replaying the effect does not open a second PR. The confirm step refuses to
resolve on an agent actor.

## Not in scope

The `/prepare` research flow, and any change to what makes a decision ready. This slice moves the **recording** of
a ruling onto the engine; how a ruling is reached is untouched.
