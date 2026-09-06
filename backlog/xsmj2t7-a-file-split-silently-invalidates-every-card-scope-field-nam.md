---
kind: story
size: 2
status: open
dateOpened: "2026-09-06"
tags: []
relatedReport: reports/2026-09-06-open-story-staleness-audit.md
---

# A file split silently invalidates every card scope: field naming the old path, and the dispatcher plans lanes off it

Found by the 2026-09-06 open-story audit. A six-way split of we:scripts/__tests__/check-standards-rules.test.mjs left #2906, #2958, #2930, #2934 and #1770 with a scope: entry naming a path that no longer exists. This one has teeth: the mechanical dispatcher reads scope: to predict lane collisions, so a stale entry mis-plans dispatch rather than merely misleading a reader. we:scripts/check-standards.mjs should error when a scope: entry in a live (non-resolved) item names a we: path absent from the checkout, the same way it already checks a code locus.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Done when

1. **Executable** — `npm run check:standards` ERRORS on a live (non-`resolved`) item whose `scope:`
   names a `we:` path absent from the checkout, and passes once the entry is corrected or dropped.
   Reproduce with #1770, whose `scope:` still names
   `we:scripts/__tests__/check-standards-rules.test.mjs` after the six-way split.
2. **Resolved items are exempt** — a resolved card is frozen history and its `scope:` correctly
   describes the tree as it was; only live items are checked.
3. **Cross-repo loci skip explicitly** — a `fui:` / `plateau:` entry is reported as skipped, never
   silently passed.
4. A test covers both arms: a live item with a present path passes, one with an absent path errors.

## Why this is an error, not a warn

Unlike a prose citation, `scope:` is *machine-read*: the mechanical dispatcher uses it to predict
which lanes collide. A stale entry does not merely mislead a reader — it mis-plans dispatch, so two
items that genuinely overlap can be scheduled in parallel. That makes it a fail-closed concern.

## Known affected items (2026-09-06 audit)

#2906, #2958, #2930, #2934, #1770 — all invalidated by the same
`we:scripts/__tests__/check-standards-rules.test.mjs` six-way split.
