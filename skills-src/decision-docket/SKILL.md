---
name: decision-docket
description: Build or refresh the Decision Docket — the published Artifact page listing open decisions ranked by leverage, with every prepared item's full fork breakdown (every option, every rejection reason, the bold default). Use when the user asks to "build/refresh the decision docket", "publish the decision board", "show me the open decisions", or when a decision-mode session (see next-backlog-item / prepare-decision-item) wants to surface its ranked prepared set as a page instead of chat prose. Run `node scripts/operations/run.mjs docket-refresh --apply` FIRST — the declared operation that fetches, ranks, renders, and hands off the Artifact URL + parseOk:false count in one call; hand-fill only what it still flags `parseOk: false`.
---

# Decision Docket — the ranked, full-fork-detail decision page

The Decision Docket is the "prepared to decide" half of the shared **Decision Board** artifact
(see `we:docs/agent/backlog-workflow.md#decision-docket`, `we:backlog/3562`, `we:backlog/3723`,
`we:backlog/x7wehz2`). It lists open decisions ranked by leverage (what they unblock, how long
they've waited) and gives **every prepared item its full fork breakdown**, not a title-and-a-row
summary.

## The primary path — one operation call, then one Artifact publish

```bash
node scripts/operations/run.mjs docket-refresh --apply
```

Run this from a **lane or the runner's checkout, never the primary checkout** — the operation
writes files (the data, the rendered page, its own state) and the primary-cwd guard (#2749/#2788)
blocks any fs-writing script there. If your session's cwd IS the primary, `cd` into a lane first
(`node scripts/lane-pool.mjs status --json` to find one, or adopt/clone one) and run the command
from there. Pass `--force` when you were asked explicitly to refresh and want a page + hand-off
even if the operation reports the ranked data hasn't changed since the last run (the default
behaviour is a no-op on an unchanged hash — correct for an automated trigger, not for "refresh it
now, I want to see the current page regardless").

The operation:

1. Fetches `origin/main` and refuses if the checkout isn't at that ref (bring it up to date first —
   `git fetch && git merge --ff-only origin/main` in the lane — and re-run).
2. Runs the checkout's own generator (`scripts/gen-decision-docket.mjs`) with outputs under the
   operations state root — nothing inside the checkout, nothing to commit.
3. Content-hashes the result against the last run; on a change (or `--force`) it renders the page
   and writes a `publish-owed.json` hand-off.

Read the **last few stdout lines** — they are the whole answer:

```
docket-refresh: data <path>/decision-docket-data.json (91 decisions, 55 prepared, 3 with parse warnings; content 65248781a333)
docket-refresh: parseOk:false — 3 item(s): #3114, #3115, #3123
docket-refresh: the docket data differs from the last refreshed data
docket-refresh: publish owed, recorded at <path>/publish-owed.json (page <path>/decision-docket.html); artifact https://claude.ai/artifact/KjSHDBsszGcJ6cTX8fHedG; publish via #3277 …
publish: owed
```

- **`publish: owed`** — a change was found; the `page <path>` line names the rendered HTML and the
  `artifact <url>` names the Artifact to update. Read the page and pass it to the `Artifact` tool
  with `url: <that url>`. **Done** — no listing, no hand-authoring, unless parseOk:false > 0 (below).
- **`publish: none`** — nothing changed since the last refresh; there is nothing to publish.
- **A `REFUSED` line** — read it; it says exactly what's wrong (primary checkout, or the checkout is
  behind `origin/main`) and how to fix it.

The Artifact URL comes from the tracked `skills-src/decision-docket/artifact.json`
(`{"url": "...", "title": "Decision Docket"}`) — the operation reads it for you, so you never need
`Artifact(action:"list")` to find the page. If a stdout line instead says *"no
skills-src/decision-docket/artifact.json found"*, the pointer file is missing or was moved; find
the page with `Artifact(action:"list", type:"…")`/by title and update `artifact.json` with its URL
so the next refresh doesn't have to ask again.

### Only if `parseOk:false` > 0 — hand-fill just those cards

The stdout line already names them (`parseOk:false — N item(s): #A, #B, …`). For each one:

1. `cat backlog/<NUM>-*.md` — read the item's own body.
2. Open the rendered `reports/decision-docket.html` (or the page path the operation printed) and
   hand-author **just that card's** `.dcard` block from `template.html`'s markup (below), leaving
   every other, already-generated card untouched.
3. If the same shape recurs across items (a new but legitimate authoring convention the parser
   doesn't recognize yet), that's a parser gap worth fixing at the source
   (`scripts/lib/decision-docket-data.mjs`) rather than a hand-fill to repeat every refresh — file
   or fix it so the count trends toward zero, never treat a growing hand-fill list as normal.
4. Publish as usual once every listed card has its `.dcard`.

**`template.html`**, alongside this file, captures the verified, current token palette
(`--paper`/`--surface`/`--ink`/`--accent`/`--fresh`/`--wait`/`--stale`, plus the `.dcard` card
component) and the fork-breakdown classes a docket needs: **`.forkhd`** (one per `## Fork N`),
**`.opt`** (one per lettered option), **`.oc`** ("option, chosen" — the bold default) and **`.ov`**
("option, void" — a rejected option, styled to make its rejection reason visually mandatory, never
an afterthought). Pull from it every time; do not restyle per refresh.

## The hard rule this skill exists to make actually happen

**Every prepared item the docket lists renders through the `.dcard` fork-breakdown markup** —
every `## Fork N`, every `(a)`/`(b)`/`(c)` option, the reason each non-default option was rejected,
and the bold recommended default. This is not optional for "the current batch" and skipped for the
rest; it applies to **every** prepared item on the page, regardless of how it got there or how
close the session is to ratifying it that turn (see the *"does not vary by section"* clause in
`docs/agent/backlog-workflow.md#decision-docket`). This holds for a hand-fill exactly as much as
for a generated card — a hand-filled card that skips an option or a rejection reason to save time
reproduces the exact defect this skill was written to end.

**The compact summary table (`.tw table`) is for context and ranking only** — unblocks count,
to-ready count, age — never a substitute for the fork breakdown.

A prepared **validation-gate** item (a one-sided go / no / not-yet call — no `## Fork N` by design)
gets the same full card with a `GATE` heading in place of the forks: what is being decided, the
prior-art delta, the recommended verdict and un-gate trigger as the one default card, and its
`Skeptic:` line. The generator reads it from the item's `## What you're deciding`, `## Context &
prior-art delta` and `## Recommendation` sections; a gate whose `## Recommendation` carries no
`Skeptic:` line comes back `parseOk: false` like any other item.

An item that is **not yet prepared** (no `## Fork N` sections, no bold default) does not get a
`.dcard` — it belongs in an "upstream / not yet prepared" table instead, so the page never dresses
up cold research as a ready ratification.

## When to run it

On request, or when a decision-mode session (`/next decision`, `/prepare`, a ratification batch)
wants a page instead of chat prose to hand the operator. Not a timer job (that standing, tick-driven
pass is `backlog/3562`, still blocked on the conveyor wiring — this skill's operation is the refresh
+ hand-off half `backlog/3723` delivers; nothing calls it automatically today). Typical triggers:

- a new item gets prepared (stamped `preparedDate`) and should join the ranked set
- a batch gets ratified — re-run so ratified cards drop out and the ranking reflects what landed
- the operator asks "what's on the docket" / "show me the open decisions"

## What NOT to do

- Don't skip the operation and hand-author the whole page "to save a step" — that is exactly the
  visual-language drift (two published revisions once used two different token palettes and
  component names) and hand-fill inconsistency this skill exists to end. The operation is always
  step one; hand-fill is a targeted fallback for `parseOk: false` cards only.
- Don't invent new color tokens or component names per refresh. If a genuinely new shape is needed,
  add a class in the existing palette, don't start a new design language.
- Don't render a prepared item as a table row only, generated or hand-filled. Re-read *the hard
  rule* above — it does not vary by section or by how the item got there.
- Don't drop the rejection reason on a `.ov` option to save space. A rejection with no stated
  reason is not a rejection a decider can evaluate — it's a hidden default with an extra step.
- Don't hand-summarize a fork's `Skeptic:`/`Screen:` verdict into "looks fine" — quote what the
  item's body actually says (`REFUTED → flipped to …` / `SURVIVES — beat <attack>` /
  `SURVIVES-WITH-AMENDMENT → …` / `clear` / `flagged(impl|prio) → <fix>`).
- Don't write session narrative about the refresh itself onto the page ("second pass",
  "correction", "false alarm"). A mistake in a prior render is fixed by re-running the operation
  from corrected data; the fix's history lives in `git log` on the backlog files and, once #3562
  ships, on the tracked data snapshot — never as a paragraph in the published page.

## Reference: the `.dcard` markup a hand-fill produces

For the rare `parseOk: false` card, build the same shape the generator produces for every other
item: the digest paragraph, then one `.forkhd` + `.opts` block per `## Fork N`, each option as an
`.opt.oc` (the default) or `.opt.ov` (rejected, reason included), the `Skeptic:`/`Screen:` line, and
a `.thecall` footer naming what happens once ratified. Copy an already-generated card's markup from
the rendered page as your starting shape rather than authoring from a blank template — matching a
sibling card is the fastest way to stay byte-consistent with the palette.
