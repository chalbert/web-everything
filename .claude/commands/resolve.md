---
description: Resolve a backlog item (or, with no NNN / `next` / `all`, the gate's "all slices done" epics that pass a scope-delivered review). For an epic, only after every child is resolved (the no-open-slice guard). Mechanical status splice + gate.
---

Resolve backlog item(s) per **`$ARGUMENTS`**. A leading `NNN` is one explicit item (an optional
`--graduated-to=…` passes straight through). If `$ARGUMENTS` is **empty**, or is `next` / `all`,
operate in **discovery mode** (step 0). This is the mechanical close-out — a status splice via
`backlog.mjs`, then the gate. For an **epic** it additionally enforces the *no open slice* invariant so
you never create the `resolved-epic-with-open-child` contradiction the gate would later flag.

> **Lane note (#2123).** `resolve`'s status change is a **sanctioned frontmatter splice via
> `we:scripts/backlog.mjs`** — exempt from `we:scripts/guard-lane.mjs`, so this specific splice is *not*
> what forces a lane. But if you reached `resolve` as the tail of *building* an item, that build's edits
> already had to happen in a lane clone, and the commit/land here belongs to the same lane→PR flow (direct
> `main` writes are blocked by `we:scripts/guard-bash.mjs`, #2203) — do not run the build in the primary
> checkout and then resolve on top of it. How the splice/commit lifecycle composes with lane isolation is
> being reconciled — **#2219**.

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

   **A failing candidate must come with its reconciliation OFFER, never a bare "kept open" verdict.**
   The whole point of step 1a is that a non-resolvable item can't just stay parked at the resolve cue —
   so when a candidate fails scope-review, the one-line verdict is paired with the concrete next action
   the failure dictates (per 1a's reconciliation menu) and an offer to do it now: a finite burndown with
   carvable tail → *"offer to `/slice NNN` the next wave"*; a stale block → *"offer to re-point
   `blockedBy`"*; a live stall → *"offer to stamp the `childlessReason` + edge"*. Don't hand the user a
   verdict that leaves them to re-discover and manually invoke `/slice` — name the fix and offer to run
   it. (Acting on the offer is its own follow-up turn; discovery itself still only *resolves* the first
   passing candidate.)

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

   **Validate any program claim against the Program Test (the #1442 lesson).** An epic carrying
   `childlessReason: program` or `ongoing: true` is *exempt from the gate's resolve nudge* — so it will
   NOT surface in discovery, and when you meet one (explicit `NNN`, or while sweeping) you must check the
   flag is *earned*, not a hack to silence the cue over an uncarved tail. Apply the four-part **Program
   Test** (docs/agent/backlog-workflow.md → Programs): a real program has **no Definition of Done** —
   *if you resolved every current child it would NOT end* (drift/the world keeps moving spawns the next
   slice), plus a named conformance front + a currency front. **A finite goal — "convert all blocks",
   "prepare all decisions", any "do X across the whole set" that ends when the set is drained — FAILS
   the test: it is a burndown epic, not a program**, no matter how long the tail. (Tell: a *resolved*
   item that was flagged `program` is proof — programs never resolve.) If the flag is unearned, do NOT
   park and do NOT resolve → reconcile via **"not a program → drop the flag and slice"** below.

   On **fail, you MUST reconcile it — a non-resolvable item can never just stay parked at the resolve
   cue** (the gate would re-flag it every run, the limbo this guard exists to kill). First **validate any
   stated block is still live**, then drive exactly one reconciliation. Present the options for the item,
   recommend one, and apply it:

   - **Stale block → re-point (check this FIRST).** If the epic is `blockedBy: [...]`, resolve each edge
     and confirm the targets are still **open**. If they're now **resolved**, the block is stale — the
     item only *looks* non-resolvable. Do NOT leave it "blocked": find the genuine remaining dependency
     (read the body / any readiness-map child), **file it if it doesn't exist yet** (`backlog.mjs
     scaffold …`, set its `locus`/`relatedProject`), and **re-point** `blockedBy` at the real open item.
     If there is no real remaining dependency, the block was the only thing holding it open → fall to
     *scaffold the next slice* or *resolve* as the scope dictates. (This is the #1210 case: `blockedBy:
     [1175,765]` both resolved → re-pointed at the FUI-build #1228.)
   - **Not a program → drop the flag and slice (the #1442 reconciliation).** When the epic FAILED the
     Program Test above — a finite burndown wearing `childlessReason: program` (or a mis-set `ongoing:
     true`) to suppress the resolve cue over an uncarved tail — the fix is to **retag it as needing
     slicing, not to park or resolve it**: (1) **remove** the false `childlessReason: program` / `ongoing`
     flag; (2) **carve the next batchable wave** as child slices (run `/slice NNN`, or
     `backlog.mjs scaffold … --parent=NNN`) so it gains open children and reads `tracking` honestly — the
     resolve cue stays off because real open work now sits under it, not because a flag hides it. Don't
     pre-scaffold the entire tail; one wave is enough (the rest file on pickup). The epic resolves only
     when the last wave lands. (#1442: dropped `childlessReason: program`, carved wave-2
     meter/progress/checkbox/radio → `tracking`.)
   - **Scaffold the next slice.** The remaining scope is carvable now → create the next child item
     (`backlog.mjs scaffold … --parent=NNN`). The epic now has an open child, so it's no longer "all
     slices done."
   - **Declare the stall (only on a LIVE edge).** The remaining scope genuinely can't be carved yet
     (blocked / untriaged, or `program` **only** for a genuine perpetual program that *passed* the
     Program Test — never as a cover for a finite tail, which is the case above) → ensure the epic carries
     the matching `childlessReason`
     **and**, if blocked, a `blockedBy` edge to a still-**open** item. The gate's `CHILDLESS_REASONS`
     exemption then makes this a legitimate steady state and the candidate stops re-surfacing — but a
     `childlessReason: blocked` with no live blocker is the stale-block trap above, not a valid stall.
     **An open *design decision* is never an inline reason: `childlessReason: undecided` is retired and
     the gate errors on it.** Carve the fork to a `kind: decision` item and use `childlessReason: blocked`
     + a `blockedBy` edge to it. ("Slices not yet scoped" with no open decision is just the unsliced
     state — no `childlessReason` at all.)

   A blocked epic that already declares a `childlessReason` is only *already reconciled* once you've
   confirmed its blocker is still open — otherwise reconcile per the stale-block path. Never close on
   `--force` to clear a warning; reconcile the real state instead.

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
