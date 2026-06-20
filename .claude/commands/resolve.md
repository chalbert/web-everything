---
description: Resolve a backlog item (or, with no NNN / `next` / `all`, the gate's "all slices done" epics that pass a scope-delivered review). For an epic, only after every child is resolved (the no-open-slice guard). Mechanical status splice + gate.
---

Resolve backlog item(s) per **`$ARGUMENTS`**. A leading `NNN` is one explicit item (an optional
`--graduated-to=…` passes straight through). If `$ARGUMENTS` is **empty**, or is `next` / `all`,
operate in **discovery mode** (step 0). This is the mechanical close-out — a status splice via
`backlog.mjs`, then the gate. For an **epic** it additionally enforces the *no open slice* invariant so
you never create the `resolved-epic-with-open-child` contradiction the gate would later flag.

Do exactly this, in order:

0. **Discovery mode (only when no explicit `NNN` given).** Run `npm run check:standards` and collect the
   epics it flags with `every child is resolved ('all slices done')` — these are the resolution
   candidates. For **each** candidate apply the **scope-delivered review** in step 1a *before* touching
   it. Then:
   - `next` (or empty `$ARGUMENTS`) → resolve only the **first** candidate that passes review; report the
     rest as candidates with a one-line verdict each.
   - `all` → resolve **every** candidate that passes review; for each that fails, leave it open and give
     the one-line reason. Resolve + verify + commit them one at a time (loop steps 3–5 per item) so each
     lands as its own commit.
   If discovery finds no candidates, say so and stop.

1. **Locate the item.** Find `backlog/NNN-*.md`. If none, stop and say so. Read its frontmatter —
   note `workItem`, `status`, `blockedBy`, `childlessReason`.

1a. **Scope-delivered review (epics only — do NOT skip for "all slices done" items).** The gate's
   *all slices done* nudge fires when every **carved** child is resolved — it does **not** prove the
   epic's *scope* shipped. Before resolving, confirm the scope is genuinely delivered, not just that the
   one slice that happened to be carved closed. **Keep the epic open** (and offer to scaffold the next
   slice) when any of these hold — closing here is the `#1167`/`#1210` "resolved over uncarved scope" trap:
   - the epic is `blockedBy: [...]` or `childlessReason: blocked` (its remaining scope can't even be
     carved yet);
   - the body frames the resolved child as a **"first slice"** / lists **"Slices:"** implying more to come;
   - the epic states its own **resolution criterion** ("resolves when …") and that criterion isn't met.
   An epic passes review when its scope was actually delivered by its children, or every remaining strand
   is a **deliberate deferral that cites its tracking `#NNN`**. State the pass/fail verdict in one line.

   On **fail, you must reconcile it — never leave it as a bare "kept open"** (the gate would just re-flag
   it every run, the limbo this guard exists to kill). Drive one of:
   - **scaffold the next slice** — the remaining scope is carvable now → create the next child item
     (`backlog.mjs scaffold …`, parented to the epic). The epic now has an open child, so it's no longer
     "all slices done"; OR
   - **declare the stall** — the remaining scope can't be carved yet (blocked / undecided / untriaged /
     program) → ensure the epic carries the matching `childlessReason` (and a `blockedBy` edge if it's
     blocked). As of the gate's `CHILDLESS_REASONS` exemption, a declared `childlessReason` is a
     legitimate steady state and clears the nudge — so the candidate stops re-surfacing.
   Present these as the options for the item and apply the one that fits (a blocked epic that already
   declares its `childlessReason` is *already* reconciled — confirm and move on).

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

Report format: one line per item touched — `✓ resolved #NNN`, `✗ blocked — open children`, or
`▷ kept open #NNN — <scope-not-delivered reason>` — then the final gate result line, then the one-line
commit note(s). In discovery mode, list every candidate with its verdict. Nothing else.

$ARGUMENTS
