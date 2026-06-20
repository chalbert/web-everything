---
description: Resolve a backlog item — for an epic, only after every child is resolved (the no-open-slice guard). Mechanical status splice + gate.
---

Resolve backlog item **`$ARGUMENTS`** (the leading `NNN` is the item; an optional `--graduated-to=…`
passes straight through). This is the mechanical close-out — a status splice via `backlog.mjs`, then the
gate. For an **epic** it additionally enforces the *no open slice* invariant so you never create the
`resolved-epic-with-open-child` contradiction the gate would later flag.

Do exactly this, in order:

1. **Locate the item.** Find `backlog/NNN-*.md`. If none, stop and say so. Read its frontmatter —
   note `workItem` and `status`.

2. **The no-open-slice guard is enforced by the CLI.** As of #658, `backlog.mjs resolve` itself refuses
   to close a `workItem: epic` that still has open children — it enumerates them by the `parent:` EDGE
   (never the body's stale "N children" prose) and dies *before* writing, listing each `#NNN — status`.
   So you don't grep by hand. If step 3 reports the refusal, **STOP**: report that checklist, say the
   umbrella can't close while live work sits under it, and resolve or re-parent those children first.
   Only pass `--force` if the caller has explicitly accepted closing over open children (e.g. a
   mid-re-parent). An epic with every child resolved (or none) resolves cleanly — the *all slices done*
   case the gate nudges you to reconcile.

3. **Resolve.** Run `node scripts/backlog.mjs resolve NNN [--graduated-to=…]`. `resolve` is legal from
   `open` or `active`, so an open epic umbrella closes directly — no claim step. For an epic whose scope
   was delivered by its children (it spawned no single new entity of its own), pass
   `--graduated-to=none` unless the caller named a target; for a normal item, pass the entity it became
   if there is one.

4. **Verify green.** Run `npm run gen:inventory` then `npm run check:standards`. Confirm the epic/child
   reconciliation warning for this item is gone and report the final `N error(s), M warning(s)` line. If
   a new error appears for this item, surface it verbatim.

5. **Commit (only if the working tree for this item is the only change you made).** Per the repo's
   commit-each-finished-piece rule, stage **only** this item's file (and any child re-parent you made) and
   commit `backlog: resolve #NNN — <title>`. Never `git add -A`, never push.

Report format: a one-line verdict (`✓ resolved #NNN` or `✗ blocked — open children`), then the gate
result line, then the one-line commit note if you committed. Nothing else.

$ARGUMENTS
