---
bornAs: xudsp7g
kind: task
status: open
dateOpened: "2026-09-06"
tags: []
relatedReport: reports/2026-09-06-open-story-staleness-audit.md
---

# No reopen verb in the backlog CLI, so undoing a bad resolve is a hand edit of frontmatter

we:scripts/backlog.mjs release only covers active|preparing to open. A card resolved in error - the #2756 case, resolved over a frontierui Rust SSR subtree that never landed - can only be reverted by hand-editing status, dateResolved and graduatedTo out of the frontmatter, which is exactly the unguarded write the lane guard and the mechanical verbs exist to prevent. Add reopen NNN --reason=<text>: resolved to open, strip dateResolved and graduatedTo, and require a reason it appends to the card so the reversal is self-documenting. Pairs with #3502, which stops the bad resolve landing in the first place; this one makes the cleanup mechanical when it does.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Done when

1. A new `reopen <NNN> --reason='<text>'` verb in `we:scripts/backlog.mjs` flips a `resolved` item to `open`, removes
   `dateResolved` and `graduatedTo`, and appends a dated "Reopened — <reason>" section to the card.
2. It **refuses without `--reason`** — a silent reversal loses the only record of why the resolve was wrong.
3. It refuses a non-`resolved` item with a named reason (`not-resolved`), the same shape the other verbs use.
4. A test covers all three arms.

## Why

`release` handles `active|preparing → open` only, so there is no mechanical path back from `resolved`.
The #2756 reversal in the 2026-09-06 audit had to hand-edit three frontmatter keys — the exact
unguarded write the lane guard and the mechanical verbs exist to prevent, and easy to get subtly wrong
(leaving `dateResolved` behind makes the card look resolved to any consumer reading dates).

Pairs with #3502: that card stops a bad resolve from landing; this one makes the cleanup mechanical
when one does.
