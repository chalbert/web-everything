---
name: next-backlog-item
description: Review the backlog and pick the next item to work on, prioritizing items an agent can implement now (dev-ready) over open design decisions. Use when the user asks "what's next?", "what should I work on?", "pick/select the next backlog item", or "review the backlog and choose". Pass the keyword `decision` (or `review`) to invert the bias and surface the single highest-leverage decision to make instead of a build.
---

# Select — and work — the next backlog item

Trigger + pointer — the rubrics live in
[docs/agent/backlog-workflow.md](../../../docs/agent/backlog-workflow.md) (**"Selecting the next
item to work on"**, **"Working an item"**, **"Closing out a completed item"**), so every agent
(Claude, Copilot, Cursor) uses the same method and there is nothing to keep in sync here. This skill
covers the whole arc: pick it → claim it → keep its progress in sync → mark it `resolved` when done.

## Quick path — the common case is four commands

Run these for a plain "pick the next item and do it." **Open `backlog-workflow.md` only when you hit an
edge case** — decision-mode (no Tier A), a stranded `active` claim to resume, or a blocker-DAG repair —
not on every invocation. The deterministic CLIs replace the old "re-glob + re-tier in prose" pass.

1. **`npm run check:readiness -- --select`** → take the ranked **Tier-A / batchable** list (instant,
   identical to the `/backlog/` Prioritisation tab). Don't re-derive tiers by hand.
2. **Shortlist the top 3–5**, skim **only those** bodies for a buried design fork, present them with a
   recommendation, and offer the pick via `AskUserQuestion`. (Re-`cat` the chosen item + `git status
   --short` right before committing, to win the concurrency race.)
3. On "go": **`node scripts/backlog.mjs claim <NNN>`** (race-safe `open→active` + `dateStarted`), then
   **STOP** and emit the rename slug it printed (claim is its own turn — step 4).
4. **Work**; keep the item's `## Progress` block in sync as you go.
5. **Close out:** run the gate (relevant tests + `npm run check:standards` green), capture any leftover
   as its own item with **`node scripts/backlog.mjs scaffold --type=… --workitem=… --size=… --title="…" --digest="…" [--blocked-by=NNN]`**,
   then **`node scripts/backlog.mjs resolve <NNN> [--graduated-to=<entity>|none]`**.
6. **Hand off** the carry-forward shortlist (step 8).

The numbered steps below are the full reference (edge cases, concurrency guards, decision-mode); the
quick path above is the happy path through them.

When invoked:

**0. If an item was named in the invocation, skip selection.** When the caller passes an item
(a bare `NNN` like `100`, or a full `NNN-slug` like `100-requirement-as-code`), do **not** run the
ranking flow (steps 1–3). Instead:

- **Resolve it** against `backlog/*.md`. Match on the `#`-id (`NNN`) or the filename slug. If nothing
  matches, or the id is ambiguous, say so and fall back to the normal selection flow (steps 1–3).
- **Check its status.** If `open` → go straight to **Claim it** (step 4) and continue the arc from
  there. If already `active` → route to **Resume** (step 6) instead of re-claiming. If `resolved` or
  `parked` → confirm with the user before reopening it to `active`.
- **Skip the shortlist and `AskUserQuestion`** — the user already chose. Everything from step 4 on
  (claim-as-its-own-turn, keep `## Progress` in sync, close-out gate) still applies unchanged.

**0b. If the invocation is the keyword `decision` (or `review`), run decision-mode — surface the
one most meaningful decision, not a build.** When the caller passes the bare word `decision` (or
`review`) instead of an `NNN`/slug, they're explicitly asking for the highest-leverage *call to
make*, not an agent-ready build. So **invert the Tier-A bias**: skip the agent-ready ranking
(steps 1–3) and run `backlog-workflow.md` → **"When nothing is agent-ready — surface the one
highest-leverage blocker"** directly, even if Tier-A items exist:

- **Gather** `status: open` items as in step 1, but keep only `type: decision`/`review` (and any
  open item explicitly blocking others). Apply the same concurrency guards (`git status --short`,
  re-read before committing).
- **Rank by downstream-unblock leverage** per that section: most dependents wins (items that name
  it, roll under it via `parent`, or sit in its chain); break ties by the size of gated work, then
  prefer the smallest/cheapest decision (a one-nod Tier-B ratification over a wide-open fork).
- **Claim it before discussing — ownership first, so concurrent sessions don't collide.** A decision
  discussion *is* a claimable unit of work: two sessions talking through the same fork, with the item
  never flipped and the chat never labelled, is exactly the race this guards against. So once you've
  picked the single highest-leverage decision, **claim it as its own turn per step 4** — re-read to
  win the race, flip `status: open → active` + add `dateStarted`, save, **STOP**, and emit the rename
  prompt — *before* you present the decision's substance. The work here is the discussion, not code,
  but the claim/label discipline is identical.
- **Then, on the next turn, present exactly one** as a decision to make per **step 3a**
  (planning-as-discussion): name the open fork / human judgment it needs, list concretely which `#NNN`
  it unblocks once resolved, give the realistic options with tradeoffs and your recommendation with
  reasoning. Keep its live + md links. **No `AskUserQuestion`** — a fork is a call to make, never a
  bounded click-pick.
- **If the user redirects** to a different decision (you claimed by leverage, not by their explicit
  pick), **release the claim** — flip `active → open` — and claim the one they want instead. A
  briefly-misplaced claim is cheap; an unclaimed discussion is the race.
- **The item is the source of truth — capture clear findings in it *before* asking to ratify.** As the
  discussion exposes a clear new element that affects the call (a finding, a reframed fork, a dissolved
  option, a changed recommendation), **write it into the decision item first** — update by default, no
  permission needed — then ratify against the item; never ask the user to ratify anything that lives
  only in chat. Pause to ask before writing **only** when the conclusion is genuinely ambiguous. See
  `backlog-workflow.md` → *"The decision item is the source of truth"*.
- **Before you resolve, red-team the default** (`backlog-workflow.md` → *"Red-team the default"*).
  `✓ ready to ratify` is a self-stamp, not a check — and prep-and-ratify share one blind spot. So
  *before* flipping `active → resolved`: argue the strongest case for the main alternative and try to
  name the principle the chosen branch violates (impl-is-not-a-standard, npm-scope-mirrors-layer, the
  A–E catalog). Attack fails → ratify; attack lands → amend the default and re-attack. Inline for every
  call; spin up a throwaway **skeptic sub-agent** (prompted only to refute) for high-leverage / high-`gates` forks.
- Once it's talked through and **the call is made, close out the decision item itself** per step 7:
  flip `active → resolved`, add `dateResolved`, and record the ruling (and `graduatedTo` if it became
  an entity). The gated work then turns agent-ready — continue the arc or re-run normal selection. If
  the open-decision pool is empty, say so plainly (no decision to make right now) rather than
  inventing one.

With no item named, run the full selection flow below.

1. **Get the ranked list instantly — `npm run check:readiness -- --select` (don't re-tier by hand).**
   The loader already computes tier/batchable/leverage (the same data the `/backlog/` Prioritisation tab
   shows); the CLI prints it ordered, identical to the tab, zero desync. Then follow
   [docs/agent/backlog-workflow.md](../../../docs/agent/backlog-workflow.md) →
   **"Selecting the next item to work on"** for the rest: the CLI gives you Tier **A** (agent-ready) /
   **B** (one nod away) / **C** already ordered — your only added judgment is the body-fork pre-flight
   on the **shortlist** (does a top candidate hide a design call), plus the dependency/concurrency
   re-read before you commit to one. Do **not** re-glob and re-score all 100+ items in prose — that's
   the slow, drift-prone path the CLI replaces.
2. **Bias to Tier A — agent-ready first.** Prefer `issue`/`idea` items with a concrete, bounded
   build against proven infra and no open design fork. De-prioritize `decision`/`review` items;
   surface them for discussion rather than picking them.
3. **Present, then offer clickable options.** First output a short ranked shortlist (top 3–5,
   grouped by tier, one-line rationale each) plus the single recommended item with its reasoning —
   this is the discussion context. **Use each candidate's digest (its lead paragraph / `summary`) as
   that one-line rationale** — that's what it's for. Reviewing a candidate here counts as reviewing its
   digest: if a shortlisted item's lead paragraph is stale or no longer matches the item, **fix it on
   the spot** (cheapest moment — you're already reading it). See `backlog-workflow.md` → **"The digest"**. **Then call the `AskUserQuestion` tool** so the user can pick
   with one click instead of typing: one question (header e.g. `Next item`), with the recommended
   item as the **first** option labelled `#NNN <slug> (Recommended)` and each runner-up as its own
   option; put the one-line rationale in each option's `description`. The tool auto-adds an "Other"
   choice, so the user can still redirect in prose — selecting an option is just the fast path, not
   a constraint (this is the one place we trade discussion-style for click-to-pick, because it's a
   bounded selection among concrete items, not an open design fork). **Every offered item carries
   two links** (see `backlog-workflow.md` → *Output*): its **live page**
   `http://localhost:3000/backlog/<NNN-slug>/` (Vite `:3000` proxies `/backlog/` to 11ty `:8080`;
   `NNN` is the item's `#`-id) and its **source file** `backlog/<NNN-slug>.md` — keep these in the
   prose shortlist (the option chips are for the pick; the links live in the text above).
   **Remember the runner-ups.** The shortlist you presented here is the carry-forward list — hold
   onto the not-chosen items (their `#NNN <slug>` + one-line rationale) so close-out (step 7) can
   re-offer them without re-analyzing the whole backlog.

   **3a. If the recommended item is a `decision`/`review` (Tier B/C), claim it, then present the
   decision to be made — don't offer it as a build.** A fork is a call to make, not a build to start —
   but discussing it is still claimable work, so **claim it first** (step 4: re-read to win the race,
   flip `open → active` + `dateStarted`, STOP, rename prompt) so a concurrent session won't talk
   through the same fork. *Then*, on the next turn, **skip the `AskUserQuestion` click-to-pick** and lay
   the decision out in prose (planning-as-discussion): the open fork / human judgment it needs, the
   realistic options with their tradeoffs, and your own recommendation with reasoning — keep its live +
   md links. **First run the fork-readiness pass** (`backlog-workflow.md` → step 3a's *Fork-readiness
   pass*): **research the fork first** (a greenfield/standard-authoring decision must run design-first.md
   step 1 and materialize a `reports/…md` linked via `relatedReport` *before* forming any stance — don't
   present cold), then confirm the item has a concrete example, names its options with tradeoffs, and is
   short/concise/well-explained — and **fix the item on the spot** if it falls short, since you're
   already reading it to present it (same fix-on-the-spot rule as the digest). If the user redirects to a
   different item, release the claim (`active → open`) and claim that one. Expect follow-up questions; treat it settled only once you've talked it through. Once the
   call is made, close out the decision item (step 7: `active → resolved` + `dateResolved` + the
   ruling); the item's successor build then becomes agent-ready — continue the arc / re-run selection.
   (The `AskUserQuestion` fast-path in step 3 is **only** for a bounded pick among ready Tier-A items,
   never for a design fork.)

   **3b. If no Tier-A item exists** (ready pool empty — all that's left needs a design call), do **not**
   dump a menu of decisions. Follow `backlog-workflow.md` → **"When nothing is agent-ready"**: surface
   the **single** highest-leverage blocker — the one open `decision`/`review` whose resolution unblocks
   the most downstream items — name what it's blocking and which `#NNN` it would free, **claim it first**
   (step 4, as in 3a — ownership before discussion), and present it as the decision to make per **3a**
   (planning-as-discussion, **not** `AskUserQuestion`). Resolving it (close out per step 7) turns work
   agent-ready; then re-run selection.

**Once the user says go — track it in the item, not just in your head** (per `backlog-workflow.md`
→ **"Working an item"**). The backlog file is the durable, resumable record; recovering a prior chat
session is not reliable, so the item body *is* the contract:

4. **Claim it on start — claiming is its own turn; do not start work in it.** This step (and its
   rename prompt) runs whenever you flip an item to `active` — **including `decision`/`review` mode**
   (step 0b/3a/3b), where the claimable "work" is the discussion itself: claim and rename *before* you
   present the decision's substance, so a concurrent session won't talk through the same fork. Run
   **`node scripts/backlog.mjs claim <NNN>`** — it wins the race (refuses if no longer `open` or the file
   is dirty), flips `open` → **`active`** + stamps `dateStarted` (today) in one splice, and prints the
   rename slug. (`check:standards` does not backfill `dateStarted`, so the command stamping it is the
   point.) Claim *before* coding (or before discussing, in decision mode), so a fresh session won't re-pick it.
   (`dateStarted` is the only date known at claim time — `dateResolved` and any `graduatedTo` come later,
   at close-out in step 7.)
   Then **STOP that turn immediately** — the claim edit and the session-label prompt are the *only*
   things that turn does. Do **not** chain file reads, planning, or any other tool call after the
   flip; if you keep working, the label prompt gets buried and silently skipped (the slip this guards
   against). End the turn with the "Claimed #NNN — starting next" note, then the label prompt (Claude
   can't rename programmatically; there is no `/rename` command): tell the user to rename this chat via
   the chat tab menu, and emit the bare `<NNN-slug>` in its **own fenced code block** so the VSCode chat
   UI shows a one-click copy button (inline code gets no copy button). For example:

   > Rename this chat via the tab menu to label this session — copy:
   > ```
   > 089-monetization-tiers
   > ```

   Begin the actual work on the *next* turn.
5. **Keep it in sync as you go.** Maintain the `## Progress` block (Status / Branch / Done / Next /
   Notes) and update it *as work happens*, not at the end — if the session is lost, that block is all
   the next one has. Flip back to `open` if you abandon it unfinished.
   When you claim, also **re-evaluate this item's `blockedBy` edges** against its body per
   `backlog-workflow.md` → **"Keep the blocker DAG honest"**: lift any prose prerequisite ("after #NNN",
   "blocked on…", "needs X from #NNN") into the field, and drop any spurious edge — a claim is the
   cheapest moment to fix the item you're already reading. (Do this *with* the claim edit, not as a
   separate turn-burning step.)
6. **Resume, don't re-pick, an `active` item.** Asked to continue one (or finding a stranded claim):
   read its `## Progress`, check out its branch, continue from **Next**.
7. **Close it out when done — mark it `resolved`.** Once fully done, run the gate in `backlog-workflow.md` →
   **"Closing out a completed item"**: confirm it's done (tests + `check:standards` green), take a
   **careful last look for leftovers** and capture each as its **own new backlog item** —
   **`node scripts/backlog.mjs scaffold --type=… --workitem=… --size=… --title="…" [--blocked-by=NNN]`**
   allocates the next free `NNN` atomically (winning the collision race) and writes a `check:standards`-shaped
   skeleton to fill, or author by hand (re-check `ls backlog/` right before writing and yield to the next
   free number on a collision). **Never renumber an existing item to make room** — the `NNN` is
   immutable for life (renumbering breaks `#NNN` refs and `/backlog/<NNN>/` URLs and collides under
   concurrent agents); see `backlog-workflow.md` → *Adding an item* / *Rules*. **Each new item needs a
   `workItem` (story/epic/task) and, if a story or unstoried epic, a Fibonacci `size`** — see
   `backlog-workflow.md` → *Agile sizing*. **Set each new item's `blockedBy` correctly as you author it**
   (per `backlog-workflow.md` → **"Keep the blocker DAG honest"**) — lift every prose prerequisite into the
   field so the spin-off doesn't enter the backlog as a falsely-ready Tier-A item. **Open each new item with
   a real digest** (a ≤100-word "what + why" lead paragraph — `backlog-workflow.md` → **"The digest"**); it's
   what selection will scan, and `check:standards` errors on a missing one. Then run
   **`node scripts/backlog.mjs resolve <NNN> [--graduated-to=<entity>|none]`** — it flips `active` →
   **`resolved`**, stamps `dateResolved` (the burndown plots it; `check:standards` errors without it),
   and sets `graduatedTo` if you pass it — then re-run `check:standards`. The file stays — `resolved` items are dropped from selection and hidden by
   default on `/backlog/`, so they're an audit trail, not clutter. Do **not** delete the file.
8. **Hand off the next pick — emit the carry-forward list.** After close-out, re-present the
   runner-ups you held from step 3 (drop any now `active`/`resolved`) as a **plain bullet
   list, not `AskUserQuestion` options** — one bullet per item: `#NNN <slug>` + its one-line
   rationale. This is a cheap shortcut, not a fresh ranking: it skips re-analyzing the whole backlog
   so the user can start a new session pre-aimed. Lead each bullet with a copyable invocation so a
   fresh session needs no selection pass — emit the top candidate's command in its **own fenced code
   block** (for the one-click copy button), e.g.:

   > Next candidates (carried from this session's shortlist — not re-ranked):
   > - `/next 100-requirement-as-code` — extract requirements as first-class artifacts
   > - `/next 102-changelog-manifest-standard` — standardize the update manifest
   >
   > Copy to start the top one in a fresh session:
   > ```
   > /next 100-requirement-as-code
   > ```

   If the invocation came from step 0 (item named directly, no shortlist gathered) there is nothing
   to carry — skip this step.

Do not duplicate the rubric here — if the selection, working, or close-out method changes, edit `backlog-workflow.md`.
