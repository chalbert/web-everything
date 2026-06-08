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
- **Present exactly one**, as a decision to make per **step 3a** (planning-as-discussion): name the
  open fork / human judgment it needs, list concretely which `#NNN` it unblocks once resolved, give
  the realistic options with tradeoffs and your recommendation with reasoning. Keep its live + md
  links. **No `AskUserQuestion`** — a fork is a call to make, never a bounded click-pick.
- Once it's talked through and resolved, the gated work turns agent-ready — then continue the arc or
  re-run normal selection. If the open-decision pool is empty, say so plainly (no decision to make
  right now) rather than inventing one.
- **Decision-mode claims nothing — so do not ask to rename the chat.** Surfacing a decision is
  discussion, not work: there is no `status` flip to `active` and therefore no session label to set.
  The rename prompt (step 4) fires **only** when an actual item is claimed to be worked. If the
  discussion resolves into an agent-ready build and the user says go, you'll reach step 4 *then* —
  and only then does the rename prompt apply.

With no item named, run the full selection flow below.

1. **Read [docs/agent/backlog-workflow.md](../../../docs/agent/backlog-workflow.md)** — follow
   **"Selecting the next item to work on"**: gather (drop `active`/`resolved`/`parked`) → score each
   candidate for dev-readiness → tier **A** (agent-ready) / **B** (one nod away) / **C** (needs
   design) → order within Tier A → run the dependency check.
2. **Bias to Tier A — agent-ready first.** Prefer `issue`/`idea` items with a concrete, bounded
   build against proven infra and no open design fork. De-prioritize `decision`/`review` items;
   surface them for discussion rather than picking them.
3. **Present, then offer clickable options.** First output a short ranked shortlist (top 3–5,
   grouped by tier, one-line rationale each) plus the single recommended item with its reasoning —
   this is the discussion context. **Then call the `AskUserQuestion` tool** so the user can pick
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

   **3a. If the recommended item is a `decision`/`review` (Tier B/C), present the decision to be made —
   don't offer it as a build.** A fork isn't work to claim; it's a call to make. So **skip the
   `AskUserQuestion` click-to-pick** for it and instead lay the decision out in prose
   (planning-as-discussion): the open fork / human judgment it needs, the realistic options with their
   tradeoffs, and your own recommendation with reasoning — keep its live + md links. Expect follow-up
   questions; treat it settled only once you've talked it through. Once resolved, the item becomes
   agent-ready (or its successor does) — then continue the arc / re-run selection. (The `AskUserQuestion`
   fast-path in step 3 is **only** for a bounded pick among ready Tier-A items, never for a design fork.)

   **3b. If no Tier-A item exists** (ready pool empty — all that's left needs a design call), do **not**
   dump a menu of decisions. Follow `backlog-workflow.md` → **"When nothing is agent-ready"**: surface
   the **single** highest-leverage blocker — the one open `decision`/`review` whose resolution unblocks
   the most downstream items — name what it's blocking and which `#NNN` it would free, and present it as
   the decision to make per **3a** (planning-as-discussion, **not** `AskUserQuestion`). Resolving it
   turns work agent-ready; then re-run selection.

**Once the user says go — track it in the item, not just in your head** (per `backlog-workflow.md`
→ **"Working an item"**). The backlog file is the durable, resumable record; recovering a prior chat
session is not reliable, so the item body *is* the contract:

4. **Claim it on start — claiming is its own turn; do not start work in it.** This step (and its
   rename prompt) runs **only when an item is actually being claimed to work** — i.e. you're flipping
   it to `active`. It does **not** run in `decision`/`review` mode (step 0b/3a/3b), which never claims
   anything; don't ask to rename the chat there. Flip the item's
   `status: open` → **`active`** and save *before* coding, so a fresh session won't re-pick it.
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
6. **Resume, don't re-pick, an `active` item.** Asked to continue one (or finding a stranded claim):
   read its `## Progress`, check out its branch, continue from **Next**.
7. **Close it out when done — mark it `resolved`.** Once fully done, run the gate in `backlog-workflow.md` →
   **"Closing out a completed item"**: confirm it's done (tests + `check:standards` green), take a
   **careful last look for leftovers** and capture each as its **own new backlog item** — allocate each a
   fresh `NNN` (highest + 1 or a never-used gap; re-check `ls backlog/` right before writing and yield to
   the next free number on a collision). **Never renumber an existing item to make room** — the `NNN` is
   immutable for life (renumbering breaks `#NNN` refs and `/backlog/<NNN>/` URLs and collides under
   concurrent agents); see `backlog-workflow.md` → *Adding an item* / *Rules*. **Each new item needs a
   `workItem` (story/epic/task) and, if a story or unstoried epic, a Fibonacci `size`** — see
   `backlog-workflow.md` → *Agile sizing*. Then flip the item's `status` → **`resolved`**, **add
   `dateResolved: "YYYY-MM-DD"`** (the burndown plots it; `check:standards` errors without it; add
   `graduatedTo` too if it became a real entity), save, and re-run
   `check:standards`. The file stays — `resolved` items are dropped from selection and hidden by
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
