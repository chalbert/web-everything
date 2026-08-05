---
kind: task
status: open
dateOpened: "2026-08-05"
tags: [review, jury, gate, security]
---

# Gate rank tables: null-prototype, and no bare-bracket membership test

A frozen object-literal lookup table read with an **untrusted key** fails OPEN. `Object.freeze` seals own
properties but does not detach `Object.prototype`, so `TABLE['toString']`, `TABLE['constructor']`,
`TABLE['valueOf']`, `TABLE['hasOwnProperty']` and `TABLE['__proto__']` all return an inherited member instead of
`undefined`. A `TABLE[key] !== undefined` membership test then passes on a word that is not in the enum at all,
and the inherited function/object compares as `NaN` in every `>=` / `>` rank comparison — false in **both**
directions, so the guard un-blocks rather than blocks.

Observed on PR #1046 (`#xdompzx`): `IMPACT_STRICTNESS` in `we:scripts/lib/jury-core.mjs` was validated with a bare
bracket read against a key that arrives as **free-form model JSON** (a reviewer authors `impactIfUnfixed`). An
invented word like `high` was correctly dropped, but `toString` was KEPT as a valid impact level and then rode a
clean accept with an uncaptured guard — the exact inverse of the feature's central fail-closed invariant. The
pre-existing `VERDICT_STRICTNESS` / `verdictStrictness` twin had the identical hole. Both were fixed in that PR
(null-prototype via a shared `frozenLookup`, membership via `Object.hasOwn`), but nothing stops the next table.

The rule is script-decidable by static scan:

1. Any `*_STRICTNESS` / rank / gloss lookup table must be **null-prototype** —
   `Object.freeze(Object.assign(Object.create(null), { … }))`, i.e. built through the shared `frozenLookup` helper.
2. Any `TABLE[expr] === undefined` / `!== undefined` membership test against such a table is a violation; use
   `Object.hasOwn`.

The rootCause worth encoding in the message: the safe-looking shape is COPIED from a position where inputs are
enum-constrained upstream (so a bare read really is safe) into a position where they are not, and `Object.freeze`
reinforces the false sense that the table is sealed. Tests written alongside such a change tend to probe a
hand-picked invented word (`high`) that happens not to be a prototype member, confirming the intent rather than
probing the mechanism — so the suite stays green on a broken invariant.

**Prevention for:** PR #1046 review, blocker 2 (`#xdompzx`).

**Locus:** `we:scripts/check-standards.mjs`, `we:scripts/lib/jury-core.mjs`
