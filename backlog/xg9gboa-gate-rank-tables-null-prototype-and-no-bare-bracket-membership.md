---
kind: task
status: open
dateOpened: "2026-08-05"
tags: [review, jury, gate, security]
---

# Gate module-level frozen lookup tables: null-prototype, built through `frozenLookup`, read via one accessor

A frozen object-literal lookup table read with an **untrusted key** fails OPEN. `Object.freeze` seals own
properties but does not detach `Object.prototype`, so `TABLE['toString']`, `TABLE['constructor']`,
`TABLE['valueOf']`, `TABLE['hasOwnProperty']` and `TABLE['__proto__']` all return an inherited member instead of
`undefined`. The default that was supposed to catch a non-member never fires:

- `TABLE[key] !== undefined` passes on a word that is not in the enum at all, and the inherited function/object
  compares as `NaN` in every `>=` / `>` rank comparison — false in **both** directions, so the guard un-blocks.
- `TABLE[key] ?? fallback` and `TABLE[key] || fallback` are the SAME hole one step quieter: `??` only fires on
  `null`/`undefined` and `||` only on a falsy value, so an inherited truthy member is rendered as if it were real
  data. **This item is scoped to include these**, not only the `=== undefined` form.

Observed on PR #1046 (`#xdompzx`), across four tables:

- `IMPACT_STRICTNESS` (`we:scripts/lib/jury-core.mjs`) was validated with a bare bracket read against a key that
  arrives as **free-form model JSON** (a reviewer authors `impactIfUnfixed`). An invented word like `high` was
  correctly dropped, but `toString` was KEPT as a valid impact level and then rode a clean accept with an
  uncaptured guard — the exact inverse of the feature's central fail-closed invariant.
- `VERDICT_STRICTNESS` / `verdictStrictness` (same file) had the identical hole, pre-existing.
- `VERDICT_LABELS` (`we:scripts/lib/review-render.mjs`), read with `??`: `renderPanelComment({ verdict:
  'toString' })` rendered `**Verdict:** function toString() { [native code] }` into a posted PR comment.
- `VERDICT_MARKERS` (`we:scripts/conveyor/jury-tree.mjs`), read with `||`: the same for the live jury tree.

All four were fixed in that PR (null-prototype via a shared `frozenLookup`, membership via `Object.hasOwn`, one
shared `rankIn` accessor), but nothing stops the next table.

The rule is script-decidable by static scan:

1. **Any module-level frozen object literal used as a LOOKUP** — rank, gloss, label, marker, glyph — must be
   null-prototype, i.e. built through the shared `frozenLookup` helper
   (`Object.freeze(Object.assign(Object.create(null), { … }))`), not a bare `Object.freeze({ … })`. The scope is
   the ROLE (a table indexed by a value), not the name: `*_STRICTNESS` was only where it was first noticed.
2. **Any defaulted read against such a table is a violation**, in every form — `TABLE[expr] === undefined`,
   `!== undefined`, `TABLE[expr] ?? d`, `TABLE[expr] || d`. Membership goes through `Object.hasOwn`.
3. **Rank reads go through ONE accessor.** `verdictStrictness` and `impactStrictness` were a hand-copied twin
   pair — same four-line body, same double `String()`, differing only in table and error string — and the diff
   that introduced the second edited both in lockstep, which is the tell. They now share `rankIn(table, key,
   label)`. A second hand-rolled membership-test-then-read against a lookup table is a violation on its own.

The rootCause worth encoding in the message: the safe-looking shape is COPIED from a position where inputs are
enum-constrained upstream (so a bare read really is safe) into a position where they are not, and `Object.freeze`
reinforces the false sense that the table is sealed. Tests written alongside such a change tend to probe a
hand-picked invented word (`high`) that happens not to be a prototype member, confirming the intent rather than
probing the mechanism — so the suite stays green on a broken invariant.

**Prevention for:** PR #1046 review, blocker 2 and round-2 findings 5 + 6 (`#xdompzx`).

**Locus:** `we:scripts/check-standards.mjs`, `we:scripts/lib/jury-core.mjs`,
`we:scripts/lib/review-render.mjs`, `we:scripts/conveyor/jury-tree.mjs`
