---
name: decision-docket
description: Build or refresh the Decision Docket — the published Artifact page listing open decisions ranked by leverage, with every prepared item's full fork breakdown (every option, every rejection reason, the bold default). Use when the user asks to "build/refresh the decision docket", "publish the decision board", "show me the open decisions", or when a decision-mode session (see next-backlog-item / prepare-decision-item) wants to surface its ranked prepared set as a page instead of chat prose. NOT a generator — until backlog/3562's mechanical pass ships, a session pulls the data and fills the template by hand; this skill's whole job is to make that hand-fill consistent instead of reinvented per session.
---

# Decision Docket — the ranked, full-fork-detail decision page

The Decision Docket is the "prepared to decide" half of the shared **Decision Board** artifact
(see `we:docs/agent/backlog-workflow.md#decision-docket`, `we:backlog/3562`, `we:backlog/3277`,
`we:backlog/x7wehz2`). It lists open decisions ranked by leverage (what they unblock, how long
they've waited) and — this is the part that has been getting skipped — gives **every prepared
item its full fork breakdown**, not a title-and-a-row summary.

## The gap this skill closes

Before this skill existed, only a **prose rule** said what the docket must contain
(`docs/agent/backlog-workflow.md#decision-docket`, landed via PR #2152):

> Every prepared item the docket lists gets its full fork breakdown — every option, not just the
> default, with the reason each rejected option was rejected, stated on merit. A rejection you
> cannot see is a rejection you cannot overrule.

There was no template or generator encoding the actual HTML/CSS structure that satisfies that
rule, so every session hand-authored the page from scratch. Two real published revisions of the
Decision Docket (read back via `Artifact(action:"read")` while building this skill) prove what
that costs: they use **two entirely different visual languages** — different fonts, different
color tokens, different component names — and, worse, **neither one actually applied its own full
fork-breakdown component to every prepared item every time.** One revision built a real
`.opt`/fork-heading component but only used it for two unstamped items, leaving its main "current
batch" section as prose paragraphs. The other never built the per-fork component at all. That is
the "looked visually inconsistent from update to update" problem this skill exists to end: the
classes for doing this right already existed in spirit, they just weren't a fixed, reusable
template anyone was required to pull from.

**`template.html`**, alongside this file, is that fixed template now. It captures the verified,
current token palette (`--paper`/`--surface`/`--ink`/`--accent`/`--fresh`/`--wait`/`--stale`, plus
the `.dcard` card component already in use) and completes it with the fork-breakdown classes a
docket needs and didn't consistently get: **`.forkhd`** (one per `## Fork N`), **`.opt`** (one per
lettered option), **`.oc`** ("option, chosen" — the bold default) and **`.ov`** ("option, void" —
a rejected option, styled to make its rejection reason visually mandatory, never an afterthought).
Pull from it every time; do not restyle per refresh.

## The hard rule this skill exists to make actually happen

**Every prepared item the docket lists renders through the `.dcard` fork-breakdown markup** —
every `## Fork N`, every `(a)`/`(b)`/`(c)` option, the reason each non-default option was rejected,
and the bold recommended default. This is not optional for "the current batch" and skipped for the
rest; it applies to **every** prepared item on the page, regardless of how it got there or how
close the session is to ratifying it that turn (see the *"does not vary by section"* clause in
`docs/agent/backlog-workflow.md#decision-docket`).

**The compact summary table (`.tw table`) is for context and ranking only** — unblocks count,
to-ready count, age — never a substitute for the fork breakdown. It exists so a reader can see the
whole ranked board at a glance before going card by card, not so a prepared item can be represented
by one row instead of a card. If a docket build genuinely can't afford full detail for every
prepared item it would otherwise list, the fix is to **list fewer items**, never to thin the detail
on the ones that stay.

An item that is **not yet prepared** (no `## Fork N` sections, no bold default) does not get a
`.dcard` — it belongs in an "upstream / not yet prepared" table instead, so the page never dresses
up cold research as a ready ratification.

## Pulling the data

Two sources, because the mechanical pass that would unify them (`#3562`) hasn't shipped yet:

**1. `check:readiness --select --json` — the ranking, for everything already landed on `main`.**

```bash
node scripts/check-readiness.mjs --select --json
```

Read `selection.tierB` — the decision-kind items. Each entry carries `num`, `title`, `prepared`,
`preparedDate`, `leverageScore`, `directUnblocks`, `transitiveUnblocks`, `unblocksToReady`. Rank by
`leverageScore` (falls back to `transitiveUnblocks` then age), same heuristic
`next-backlog-item`/readiness use everywhere else. This is a **pure projection of loader fields**
— it gives you the ranking and the `prepared`/`preparedDate` flags, but **no fork content**. For
that, read the item's own file:

```bash
cat backlog/<NUM>-*.md
```

Extract straight from the body: the digest paragraph, each `## Fork N` heading (with its
fork-existence justification line), the lettered options with the bold default and every rejected
option's stated reason, and the `Skeptic:`/`Screen:` lines. Do not summarize or paraphrase a
rejection reason down to a fragment — the rule above exists because a compressed rejection is as
useless as a missing one.

**2. Raw frontmatter — for a prepared item whose PR hasn't merged yet.**

A session sometimes prepares an item (writes the forks, stamps `preparedDate`) in a lane, and the
docket needs to reflect that *before* the `prepare-stamp` PR lands — otherwise the docket
undercounts by exactly the items freshest to the person building it. `check:readiness --select`
reads the **landed** checkout, so a not-yet-merged stamp is invisible to it. Pull the item directly
off the PR instead of waiting:

```bash
gh pr view <PR> --json headRefName -q .headRefName      # confirm the lane/* ref
gh pr diff <PR> -- backlog/<NUM>-*.md                     # see exactly what the PR changes
git show origin/<lane-ref>:backlog/<NUM>-*.md             # read the full post-PR file content
```

Treat that file exactly like a landed one for rendering — digest, forks, options, default,
`Skeptic:`/`Screen:` lines all come from the same body shape (see
`docs/agent/backlog-workflow.md#decision-docket` → *the prepared-fork shape*). The only difference
is the meta line in its `.hd` should say `prepared · PR #<n> not yet merged` instead of a plain
`prepared <date>`, so a reader knows why it might not show up yet if they check `check:readiness`
themselves. This is the exact pattern used by hand for two items in the most recent docket build —
document it here so the next session doesn't have to re-derive it.

## When to build or refresh it

On request, or when a decision-mode session (`/next decision`, `/prepare`, a ratification batch)
wants a page instead of chat prose to hand the operator. Not a timer job. Typical triggers:

- a new item gets prepared (stamped `preparedDate`) and should join the ranked set
- a batch gets ratified — move those cards to a "ratified this session" note, or drop them once
  `resolve`d, and say what landed
- the operator asks "what's on the docket" / "show me the open decisions"
- a stale-prep or turf-conflict sweep changes which prepared items are actually trustworthy (see
  the *held back* pattern in the worked precedent below) — this is a legitimate reason to reduce
  the "ready to ratify" count, and the docket should say so plainly rather than silently drop rows

## Filling the template

1. Copy `template.html` (or read it and edit in place — either way, start from it, never a blank
   file or a prior docket's HTML).
2. Fill the header stats and lede from your pulled data (ready count, needs-prep count, stale
   count).
3. Fill the ranking table — one row per `selection.tierB` entry, sorted by leverage. This is quick:
   it's a direct projection of the JSON fields, no authoring.
4. For **every** `prepared: true` entry (plus any not-yet-merged one from source 2 above), fill one
   `.dcard` in the "Prepared — full fork detail" section: the digest paragraph, then one
   `.forkhd` + `.opts` block per `## Fork N`, each option as an `.opt.oc` (the default) or
   `.opt.ov` (rejected, reason included), the `Skeptic:`/`Screen:` line, and a `.thecall` footer
   naming what happens once ratified (the codification target, or the spun-off build items).
5. Add the optional sections (*Held back*, *Ratified this session*, *Not yet prepared*) only when
   there's real content for them — an empty section is noise, not thoroughness.
6. Publish as an Artifact. Find the existing one first — `Artifact(action:"list")`, match the title
   "Decision Docket" — and pass its `url` so the refresh updates the same page instead of minting a
   new one (the same URL-stability discipline `skills-src/progress-board/SKILL.md` documents for
   its own page). If none exists yet, publish fresh and note the returned URL somewhere durable
   (a comment on `backlog/3562`, or a small `reports/decision-docket.json` state file) so the next
   session can find it without re-listing.

## What NOT to do

- Don't invent new color tokens or component names per refresh. If a genuinely new shape is needed,
  add a class in the existing palette (reuse `--accent`/`--stale`/`--fresh`/etc.), don't start a new
  design language — that drift is exactly what produced the two incompatible past revisions.
- Don't render a prepared item as a table row only. If you're tempted to do this "just for the
  ones already ratified this session" or "just for the ones filed a while ago", re-read *the hard
  rule* above — it does not vary by section or by how the item got there.
- Don't drop the rejection reason on a `.ov` option to save space. A rejection with no stated
  reason is not a rejection a decider can evaluate — it's a hidden default with an extra step.
- Don't hand-summarize a fork's `Skeptic:`/`Screen:` verdict into "looks fine" — quote what the
  item's body actually says (`REFUTED → flipped to …` / `SURVIVES — beat <attack>` /
  `SURVIVES-WITH-AMENDMENT → …` / `clear` / `flagged(impl|prio) → <fix>`).
