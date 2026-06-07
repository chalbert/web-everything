---
name: next-backlog-item
description: Review the backlog and pick the next item to work on, prioritizing items an agent can implement now (dev-ready) over open design decisions. Use when the user asks "what's next?", "what should I work on?", "pick/select the next backlog item", or "review the backlog and choose".
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

**Once the user says go — track it in the item, not just in your head** (per `backlog-workflow.md`
→ **"Working an item"**). The backlog file is the durable, resumable record; recovering a prior chat
session is not reliable, so the item body *is* the contract:

4. **Claim it on start — claiming is its own turn; do not start work in it.** Flip the item's
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
   concurrent agents); see `backlog-workflow.md` → *Adding an item* / *Rules*. Then flip the
   item's `status` → **`resolved`** (add `graduatedTo` if it became a real entity), save, and re-run
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
