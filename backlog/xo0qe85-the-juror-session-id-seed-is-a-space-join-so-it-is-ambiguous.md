---
kind: story
size: 1
parent: "3029"
status: open
dateOpened: "2026-08-10"
relatedTo: ["3028", "3050", "3029"]
scope:
  - "we:scripts/lib/judge-spawn.mjs"
  - "we:scripts/lib/judge-panel.mjs"
  - "we:scripts/lib/__tests__/judge-spawn.test.mjs"
  - "we:scripts/lib/__tests__/judge-panel.test.mjs"
tags: [plateau-loop, delivery, operations, jury, judge, panel, capture]
---

# The juror session-id seed is a space join, so it is ambiguous across runs

`deriveSessionId` is seeded on `` `${runId} ${id}` `` — a space join, which is not injective, so two different
(runId, id) pairs can derive the **same** session id. Within one panel the distinctness guarantee is intact;
it only bites if cross-run actor identity becomes load-bearing. The fix is a delimiter that cannot be forged.
**Capture only:** nothing is built here.

## The defect, reproduced

Two seeds, two different (runId, seat-id) pairs, one session id — run against `main` at
`0722238c375844a363ea7c611eb82b381a64998b`:

```
A  runId="a"    id="b c#1" -> 8f57af23-ca27-80e7-b1f3-c2510e0aa618
B  runId="a b"  id="c#1"   -> 8f57af23-ca27-80e7-b1f3-c2510e0aa618
collide: true
```

And end to end through the real caller, [we:scripts/lib/judge-panel.mjs#panelSeats](../scripts/lib/judge-panel.mjs),
not just the hash helper:

```
panelSeats runId="a"   seat id "b c#1" -> 8f57af23-ca27-80e7-b1f3-c2510e0aa618
panelSeats runId="a b" seat id "c#1"   -> 8f57af23-ca27-80e7-b1f3-c2510e0aa618
cross-run collide via panelSeats: true | distinct seats: true
```

Two structurally distinct seats, convened in two different runs, are recorded as **the same actor**.

## A second, stronger case that needs no space at all

[we:scripts/lib/judge-spawn.mjs#judgeSpawn](../scripts/lib/judge-spawn.mjs) builds its own fallback seed as
`[runId, lens].filter(Boolean).join(' ')`. The `filter(Boolean)` **drops an empty field before the join**, so a
spawn given only a `runId` and a spawn given only a `lens` collapse onto one seed even when neither value
contains a space:

```
judgeSpawn runId-only vs lens-only collide: true  2d711642-b726-8044-8162-7ca9fbac32f5
judgeSpawn seed collide (runId="r 1",lens="lens" vs runId="r",lens="1 lens"): true
```

This is the same root cause — an unescaped join over a variable field count — and it means the fix must also
stop collapsing absent fields, not only stop splitting on spaces.

## Bound it accurately — what is NOT broken

**Within one panel the guarantee is intact, and this item does not claim otherwise.**

- `runId` is fixed across a panel's seats, so `` `${runId} ${id}` `` is injective on `id`: two seeds are equal
  **iff** the two seat ids are equal.
- `panelSeats` refuses structurally, before anything spawns, on either a duplicate seat `id` or a duplicate
  derived `sessionId` — the self-check #3050 deliberately kept in the module rather than only in its tests.
- `judgePanel` always passes an explicit `sessionId` down to `judgeSpawn`, so the `filter(Boolean)` fallback
  above is never on the panel path. It reaches only a *direct* `judgeSpawn` caller, of which there are none in
  production today (`judgeSpawn` still has no production callers; only its tests and
  [we:scripts/measure-judge-spawn.mjs](../scripts/measure-judge-spawn.mjs) import it, and that one passes an
  explicit `sessionId`).

So the sibling-distinctness property that is #3050's whole product is **not** affected. This is a *cross-run*
naming defect.

## Inherited, not introduced — so it is about both modules

The shape comes from **#3028** (resolved), not from the panel. `deriveSessionId`'s own docstring already
specifies the convention: *"callers pass `` `${runId} ${lens}` ``"*. #3050 followed that convention faithfully,
substituting the richer `lens#slot` seat id for the bare lens. Fixing this in
[we:scripts/lib/judge-panel.mjs](../scripts/lib/judge-panel.mjs) alone would leave
[we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs) minting ids on the old scheme and silently
change what a given run id resolves to in one module but not the other. **Both change together, or neither.**

## When it actually matters

Only if **cross-run actor identity becomes load-bearing** — i.e. something durable keys on, or trusts, a
session id as a name that is unique across runs.

That is not hypothetical for long. [#3007](/backlog/3007-make-the-review-verdict-ledger-the-merge-authority-labels-be/)
(open) proposes an append-only verdict ledger that records **reviewer identity** alongside the verdict and
makes that ledger the merge authority. A ledger spanning many runs is exactly the consumer that turns "two runs
can mint the same actor name" from a curiosity into a wrong answer. It is worth fixing **before** such a
consumer exists rather than after — changing the derivation later invalidates every id already recorded.

Note the ordering is one-way: this item is safe to do at any time, and
[#xju8rp3](/backlog/xju8rp3-migrate-the-subject-jury-fan-out-off-subagents-onto-judgepan/)
(migrate the jury fan-out onto `judgePanel`) does not wait on it, because the intra-panel guarantee it relies
on is already intact.

## The fix, and why it is trivial

Replace the space join with an unambiguous encoding in **one** place — a helper both modules seed through:

- **NUL-delimited** — join the fields with a NUL byte, which cannot appear in a run id or a lens name; or
- **length-prefixed** — `${runId.length}:${runId}${id.length}:${id}`, which is injective without reserving any
  byte at all and is the safer choice if a field could ever be binary.

Either way the absent-field collapse must go too: encode a fixed field count, so a missing `lens` is an empty
field rather than a field that disappears.

Cost: a few lines and a table test. The only real consideration is that **it changes every derived id**, so it
is a clean break to take while `judgeSpawn` still has no production callers and no ledger has recorded an id.

## Acceptance

- [ ] One shared seed encoder, used by both `deriveSessionId` call sites — no second derivation.
- [ ] A test asserting non-collision over the pairs above: `("a", "b c#1")` vs `("a b", "c#1")`, and the
      `filter(Boolean)` pair (`runId` only vs `lens` only with the same string).
- [ ] A property-style table over field values containing spaces, `#`, and the empty string, asserting distinct
      inputs derive distinct ids.
- [ ] `deriveSessionId`'s docstring stops specifying the space-join convention, so a future caller does not
      re-introduce it.
- [ ] Every existing `judgeSpawn` / `judgePanel` test still passes with the new ids (no test hard-codes a
      literal UUID that the change would falsify — check before assuming).
