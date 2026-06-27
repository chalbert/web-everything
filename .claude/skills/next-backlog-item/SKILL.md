---
name: next-backlog-item
description: Review the backlog and pick the next item to work on, prioritizing items an agent can implement now (dev-ready) over open design decisions. Use when the user asks "what's next?", "what should I work on?", "pick/select the next backlog item", or "review the backlog and choose". Pass the keyword `decision` (or `review`) to invert the bias and surface the single highest-leverage decision to make instead of a build.
---

# Select — and work — the next backlog item

Trigger + pointer — the rubrics live in
[docs/agent/backlog-workflow.md](../../../docs/agent/backlog-workflow.md)
(*backlog-workflow.md → Selecting the next item to work on*, *backlog-workflow.md → Working an
item*, *backlog-workflow.md → Closing out a completed item*), so every agent uses the same method
and there is nothing to keep in sync here. This skill covers the whole arc: pick it → claim it →
keep its progress in sync → mark it `resolved` when done. If the selection, working, or close-out
method changes, edit `backlog-workflow.md`, not this skill.

**Mode at a glance.** Default is **build-mode** (steps 1–3 rank Tier-A agent-ready work). Two
diversions: an item named in the invocation **skips selection** (step 0); the bare keyword
`decision`/`review` runs **decision-mode** — surface the one highest-leverage *call to make*, not a
build (step 0b). All modes share the same claim → sync → close-out tail (steps 4–8).

## The loop

**0. Item named in the invocation → skip selection.** When the caller passes an item (a bare `NNN`
like `100`, or a full `NNN-slug`), do **not** run the ranking flow (steps 1–3):

- **Resolve** it against `backlog/*.md` by `#`-id or filename slug. No match / ambiguous → say so and
  fall back to selection (steps 1–3).
- **Branch on status:** `open` → go to claim (step 4); `active` → Resume (step 6); `resolved`/`parked`
  → confirm before reopening to `active`.
- Skip the shortlist and `AskUserQuestion` (the user already chose). Steps 4–7 still apply unchanged.

  **Naming an item skips *selection*, not the claim — and the claim is still its own turn.** This is
  the easy-to-miss trap: a named item (especially a `type:decision`) tempts you to dive straight into
  reading, grounding, and presenting the substance. Do **not**. For an `open` item the *only* action
  this turn is `claim` (step 4) — which STOPs to emit the rename slug — and the work begins next turn.
  **Treat the claim as the literal first tool call**: do **not** `Read` the item body, run grounding
  shell, or present any substance before the claim STOP.

  Two distinct anti-paths, only one of which is mechanically caught:
  - **Pre-claim *edit*** — caught. `backlog.mjs claim` refuses when the item's own file is dirty
    (the claim-first guard; scoped to that one file, `--force` overrides). Without it, claim would
    *silently bundle* your pre-claim edits into the claimed file — it doesn't error, which is worse,
    so the guard turns that into a hard refusal.
  - **Pre-claim *read + present*** — **NOT** catchable. Reading the body and presenting a stance in
    chat leaves no on-disk trace, so no CLI can gate it. The harm is real anyway: you form and publish
    a recommendation before the item is flipped, collapsing the two-go arc (a *selection* go vs a later
    *ratification* go) and racing concurrent sessions on an unclaimed, unlabelled item. This is exactly
    the failure the claim-first STOP exists to prevent — discipline is the only guard, so honour it.

  Claim first, ground/edit/present after.

**0b. Invocation is the keyword `decision`/`review` → decision-mode.** The caller wants the
highest-leverage *call to make*, not an agent-ready build. **Invert the Tier-A bias**: skip the
agent-ready ranking and run *backlog-workflow.md → When nothing is agent-ready — surface the one
highest-leverage blocker* directly, even if Tier-A items exist:

- **Gather** `status: open` items as in step 1, but keep only `type: decision`/`review` (and any open
  item explicitly blocking others). Same concurrency guards (`git status --short`, re-read before
  committing).
- **Rank by downstream-unblock leverage** per that section: most dependents wins (items that name it,
  roll under it via `parent`, or sit in its chain); break ties by size of gated work, then prefer the
  smallest/cheapest decision (a one-nod Tier-B ratification over a wide-open fork).
- **Claim before discussing** — a decision discussion *is* claimable work; an unclaimed,
  never-flipped, unlabelled discussion is exactly the race this guards against. Claim per step 4,
  *before* presenting the decision's substance.
- **Then present exactly one (next turn) per the decision rule below.** The user picking off the
  shortlist — a `go`, or naming an item — is the trigger to **claim + present for discussion**, *never*
  ratification authority. There are **two distinct `go`s**: the *selection* go (claim + STOP + present)
  and a later *ratification* go (resolve + close), separated by the discussion and red-team. Claiming is
  its own turn (claim, emit the slug, STOP per step 4); the discussion + red-team are the next turn(s);
  ratify + close (step 7) **only on a separate, explicit go** after the fork is actually discussed. Do
  **not** collapse claim → present → discuss → red-team → ratify → commit into the pick turn — this is
  the exact trap the step-0 named-item note warns of, and it applies to a shortlist pick just as much.
  If the user redirects to a different decision, **release the claim** (`active → open`) and claim the
  one they want instead.
- **The item is the source of truth.** As the discussion exposes a clear new element (a finding, a
  reframed fork, a dissolved option, a changed recommendation), write it into the decision item first
  — update by default, no permission needed — then ratify against the item; never ratify chat-only
  content. Pause to ask before writing only when the conclusion is genuinely ambiguous. See
  *backlog-workflow.md → The decision item is the source of truth*.
- **Before you resolve, red-team the default** (*backlog-workflow.md → Red-team the default*): argue
  the strongest case for the main alternative and try to name the principle the chosen branch violates
  (impl-is-not-a-standard, npm-scope-mirrors-layer, the A–E catalog). Attack fails → ratify; attack
  lands → amend and re-attack. Inline for every call; spin up a throwaway **skeptic sub-agent** (prompted
  only to refute) for high-leverage / high-`gates` forks.
- **Once the call is made, close out the decision item itself** per step 7 (`active → resolved` +
  `dateResolved` + record the ruling, `graduatedTo` if it became an entity). The gated work then turns
  agent-ready — continue the arc or re-run selection. If the open-decision pool is empty, say so plainly
  rather than inventing a decision.

With no item named, run the full selection flow below.

1. **Get the ranked list instantly — `npm run check:readiness -- --select`** (don't re-tier by hand).
   The loader already computes tier/batchable/leverage — the same data the `/backlog/` Prioritisation
   tab shows — printed ordered, zero desync. The CLI gives Tier **A** (agent-ready) / **B** (one nod
   away) / **C** already ordered; your only added judgment is the body-fork pre-flight on the
   **shortlist** plus the dependency/concurrency re-read before committing. Then follow
   *backlog-workflow.md → Selecting the next item to work on*. Do **not** re-glob and re-score all 100+
   items in prose.
2. **Bias to Tier A — agent-ready first.** Prefer `issue`/`idea` items with a concrete, bounded build
   against proven infra and no open design fork. De-prioritize `decision`/`review` items; surface them
   for discussion rather than picking them.
3. **Present, then offer clickable options.** Output a short ranked shortlist (top 3–5, grouped by tier,
   one-line rationale each) plus the recommended item with its reasoning — the discussion context. **Use
   each candidate's digest** (lead paragraph / `summary`) as that one-line rationale; if a shortlisted
   item's digest is stale, **fix it on the spot** (*backlog-workflow.md → The digest*). **Then call
   `AskUserQuestion`** so the user can pick with one click: one question (header e.g. `Next item`), the
   recommended item as the **first** option labelled `#NNN <slug> (Recommended)`, each runner-up its own
   option, one-line rationale in each `description`. The tool's auto-added "Other" lets the user redirect
   in prose — selecting is the fast path, not a constraint (the one place we trade discussion-style for
   click-to-pick, because it's a bounded selection among concrete items, not an open design fork). **Every
   offered item carries two links** (*backlog-workflow.md → Output*): its **live page**
   `http://localhost:3000/backlog/<NNN-slug>/` (Vite `:3000` proxies `/backlog/` to 11ty `:8080`) and its
   **source file** `backlog/<NNN-slug>.md` — keep these in the prose shortlist (chips are for the pick,
   links live in the text). **Remember the runner-ups** (`#NNN <slug>` + rationale) — that shortlist is
   the carry-forward list step 8 re-offers without re-analyzing the backlog.

   **3a. Recommended item is a `decision`/`review` (Tier B/C) → present the decision, don't offer a
   build.** Claim it first (per step 4 — discussing a fork is claimable work). *Then*, next turn, **skip
   `AskUserQuestion`** and present per the decision rule in step 0b (planning-as-discussion: open fork /
   human judgment, options + tradeoffs, recommendation + reasoning; keep live + md links). **First run the
   fork-readiness pass** (*backlog-workflow.md → step 3a's Fork-readiness pass*): **research the fork first**
   — a greenfield/standard-authoring decision must run *design-first.md step 1* and materialize a
   `reports/…md` linked via `relatedReport` *before* forming any stance — then confirm the item has a
   concrete example, names its options with tradeoffs, and is concise; **fix the item on the spot** if it
   falls short (same rule as the digest). If the user redirects, release the claim (`active → open`) and
   claim that one. Once the call is made, close out the decision item (step 7); its successor build then
   becomes agent-ready.

   **3b. No Tier-A item exists** (ready pool empty — all that's left needs a design call): do **not** dump
   a menu. Per *backlog-workflow.md → When nothing is agent-ready*, surface the **single** highest-leverage
   blocker, claim it first (step 4), and present it per step 3a. Resolving it (step 7) turns work
   agent-ready; then re-run selection.

   *(The `AskUserQuestion` fast-path in step 3 is **only** for a bounded pick among ready Tier-A items,
   never for a design fork.)*

Once the user says go, **track it in the item, not just in your head** (*backlog-workflow.md → Working
an item*). The backlog file is the durable, resumable record — the item body *is* the contract.

4. **Claim it on start — claiming is its own turn; do not start work in it.** This step runs whenever you
   flip an item to `active`, **including decision-mode** (0b/3a/3b), where the claimable work is the
   discussion itself. Run **`node scripts/backlog.mjs claim <NNN>`** — it wins the race (refuses if no
   longer `open`, or if the item's own file has uncommitted edits — the claim-first guard, `--force` to
   override), flips `open → active` + stamps `dateStarted` (today) in one splice,
   and prints the rename slug. (`check:standards` does not backfill `dateStarted`, so the stamping command
   is the point; `dateResolved`/`graduatedTo` come later, at step 7.) Then **STOP that turn immediately** —
   the claim edit and the label prompt are the *only* things that turn does. Do **not** chain reads,
   planning, or any other tool call after the flip; if you keep working, the label prompt gets buried and
   silently skipped. End the turn with a "Claimed #NNN — starting next" note, then the label prompt (Claude
   can't rename programmatically): tell the user to rename the chat via the tab menu, and emit the bare
   `<NNN-slug>` in its **own fenced code block** (inline code gets no copy button). For example:

   > Rename this chat via the tab menu to label this session — copy:
   > ```
   > 089-monetization-tiers
   > ```

   Begin the actual work on the *next* turn.
5. **Keep it in sync as you go.** Maintain the `## Progress` block (Status / Branch / Done / Next / Notes)
   *as work happens*, not at the end — if the session is lost, that block is all the next one has. Flip back
   to `open` if you abandon it unfinished. Also keep **one** `in_progress` TodoWrite entry phrased as a
   present-tense status — it's surfaced live as this card's *currently-doing* on the /backlog Active-work
   tab (*backlog-workflow.md → Working an item → Keep it in sync*); let it double as your progress channel
   instead of narrating in prose. At claim, also **re-evaluate this item's `blockedBy` edges**
   against its body (*backlog-workflow.md → Keep the blocker DAG honest*): lift any prose prerequisite
   ("after #NNN", "blocked on…", "needs X from #NNN") into the field, drop any spurious edge — do this
   *with* the claim edit, not a separate turn.
6. **Resume, don't re-pick, an `active` item.** Asked to continue one (or finding a stranded claim): read
   its `## Progress`, check out its branch, continue from **Next**.
7. **Close it out when done — mark it `resolved`** (*backlog-workflow.md → Closing out a completed item*).
   Confirm done (tests + `check:standards` green), take a **careful last look for leftovers** and capture
   each as its **own new item** via **`node scripts/backlog.mjs scaffold --type=… --workitem=… --size=…
   --title="…" --digest="…" [--blocked-by=NNN]`** — it allocates the next free `NNN` atomically and writes
   a `check:standards`-shaped skeleton (or author by hand: re-`ls backlog/` right before writing, yield to
   the next free number on collision). **Never renumber an existing item** — `NNN` is immutable for life
   (*backlog-workflow.md → Adding an item* / *Rules*). Each new item needs a `workItem` (story/epic/task)
   and, if a story or unstoried epic, a Fibonacci `size` (*backlog-workflow.md → Agile sizing*); set its
   `blockedBy` correctly (*backlog-workflow.md → Keep the blocker DAG honest*) so it doesn't enter as a
   falsely-ready Tier-A item; open it with a real digest (≤100-word "what + why" lead — *backlog-workflow.md
   → The digest*). Then run **`node scripts/backlog.mjs resolve <NNN> [--graduated-to=<entity>|none]`** — it
   flips `active → resolved`, stamps `dateResolved`, sets `graduatedTo` if passed — then re-run
   `check:standards`. The file stays (`resolved` items drop from selection, hidden by default on
   `/backlog/`) — an audit trail, not clutter. Do **not** delete the file.
8. **Hand off the next pick — emit the carry-forward list.** Re-present the runner-ups held from step 3
   (drop any now `active`/`resolved`) as a **plain bullet list, not `AskUserQuestion`** — one bullet per
   item: `#NNN <slug>` + one-line rationale. A cheap shortcut, not a fresh ranking. Lead the top candidate
   with a copyable invocation in its **own fenced code block**, e.g.:

   > Next candidates (carried from this session's shortlist — not re-ranked):
   > - `/next 100-requirement-as-code` — extract requirements as first-class artifacts
   > - `/next 102-changelog-manifest-standard` — standardize the update manifest
   >
   > Copy to start the top one in a fresh session:
   > ```
   > /next 100-requirement-as-code
   > ```

   If the invocation came from step 0 (item named directly, no shortlist gathered), there is nothing to
   carry — skip this step.
