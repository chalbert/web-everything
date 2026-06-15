---
name: batch-backlog-items
description: Work several small, agent-ready backlog items back-to-back in one session, with a validation gate at every seam and a hard stop that guarantees it ends. Use when the user wants to "batch" backlog items, run a few small items in a row, or progress faster without stopping between each. For a single item, use next-backlog-item instead.
---

# Batch — work several small backlog items back-to-back

Trigger + pointer — the method lives in
[docs/agent/backlog-workflow.md](../../../docs/agent/backlog-workflow.md) (**"Running a batch"**,
which builds on **"Selecting the next item to work on"**, **"Working an item"**, and **"Closing out a
completed item"**). Don't restate the rubric here; if the method changes, edit that doc.

## Quick path — the loop in commands

**Open `backlog-workflow.md` only for an edge case** (no Tier A → surface one decision; a stop-rule
judgment call); the happy path is these commands:

1. **`npm run check:readiness -- --select --session=<batch-slug>`** → take its **`Suggested batch — points budget`** pack (the
   greedy fill of the ranked Tier-A list up to `budget = capacityPoints × targetFraction`, where cost =
   a story's `size`, a task = 2). The **count is whatever fills the budget** — not a fixed 3; a `size·8`
   joins when it fits. Skim only the packed items' bodies for a buried fork — **that's the whole
   pre-flight.** Trust the projection: it only lists items with `blockedBy` resolved, so **don't
   re-`grep` already-resolved blockers**; **the working tree's git/commit state is irrelevant — NEVER
   inspect `git status`/`git diff` to decide eligibility, and never skip or drop an item because it (or
   the tree) has uncommitted edits.** A perpetually-dirty tree is the normal baseline; `claim` does not
   look at commit state, and concurrency is owned by the `status` transition + `reserve` holds, not git
   (see *The stop rule* → *drop-reason classifier*). **Only look one cluster deeper for a tighter
   alternative if the skim actually surfaces a fork** — clean pack → take it and go (full rule: *Running
   a batch* → *Eligibility* pre-flight note).
   **When the skim shows an item is mis-flagged** (really a decision/fork, deferred/gated, or mis-sized),
   **fix the flag in place, don't just skip it** — `type: decision` (→ Tier B), `status: parked`, or bump
   `size` (to `13` to drop it from the eligible pool) — then re-run the gate. A clean pool is the
   batch's own input (full rule: *Eligibility* → reclassification note). **The body skim is principle
   conformance, not just a fork check (#608):** also catch a stale `file:line` ref, a false premise, or a
   missing placement note, and **remediate it in place** (pure-agent fixes only — never quietly make a
   design call to force batchability); escalate only an irreducible fork as a ready-to-ratify nod. D3-readiness
   (an item whose `relatedProject` is a `concept` project with no shipped surface) is already demoted by the
   loader, so it won't reach the pool — but `npm run check:health` surfaces the deterministic governance/ref
   flags worth a glance before a long run (full rule: *Selecting* → *Principle-conformance pre-flight*). **If the eligible pool can't fill
   the budget**, the batch is simply shorter (stop rule 3) — don't pad it with `≥13`/`epic` work; those stay
   single-item (the *Other Tier-A* list), surfaced separately.
2. **Present the ordered plan, get one "go"**, and emit the single `batch-<date>-<NNN>-<NNN>…` rename
   slug (the batch labels the session **once** — no per-item rename). **On the "go", soft-hold the pack:**
   `node scripts/backlog.mjs reserve <NNN...> --session=<batch-slug>` so a second concurrent batch packs
   around your items (deprioritized, not excluded — #083). Pass `--session=<batch-slug>` to every
   `--select` (opening + top-ups) so your own holds don't sink your own chain (full rule:
   *Running a batch* → *Cross-session reservation*).
3. **Loop, per item:** **`node scripts/backlog.mjs claim <NNN>`** → work → gate in the item's **own locus**
   (look up `LOCI[item.locus]` in `check-standards-rules.mjs`: run its `gateCommand` in `repoPath`, probe its
   `devServerProbe` port for any render check, and do any `closeoutDiscipline` — exercise-app's GAP-tagging;
   a WE item is just `npm run check:standards` here) → leftovers via **`node scripts/backlog.mjs scaffold …`**
   → **`node scripts/backlog.mjs resolve <NNN> [--graduated-to=…]`** → **commit that item's changes to its
   `commitTarget` repo** (`git add <explicit paths the item touched>` then `git commit` — **stage only this
   piece's files, never `git add -A` across repos; never `git push`**; one commit per closed item). Update
   the compact ledger after each (header tracks `cost <spent>/<budget>`). The `--select` pack prints a
   per-locus gate legend (`⌂ <locus> → <gateCommand> in <repoPath>`) so a cross-locus batch is self-documenting.
4. **At each seam, evaluate the stop rule**; on continue, re-read the next item fresh (drop it only if now
   `status: active` — i.e. another session owns it; **uncommitted edits are NOT a drop reason**). **When the planned pack runs dry but budget + context remain, top up:** re-run
   `npm run check:readiness -- --select --budget=<remaining>` (remaining = budget − resolved `cost`) and
   pack its fresh suggestion — it absorbs items the just-resolved work cascade-freed to Tier A.
   **Never** pull a close-out leftover this way (unvetted — capture and leave it). The budget is a
   ceiling, not a quota: if the re-pack finds nothing new, stop short of budget. Stop → **release your
   soft holds** (`node scripts/backlog.mjs unreserve --session=<batch-slug>` — un-worked reserved items
   flow back; `claim` already dropped the ones you worked) → final ledger + stop reason + carry-forward.
5. **At close-out, calibrate:** **`node scripts/backlog.mjs calibrate --points=<cost resolved>
   --context-pct=<context the user reports> --stop-reason=<which of the 4 stops fired>`** folds the session
   into the budget estimate (the closing-session skill runs this for you; do it by hand if you stop without
   /close). Pass the **stop reason** so the estimate stays honest: only a capacity-bound stop (`budget` /
   `context`) trains it; a work-bound stop (`empty-pool` / `fork` / `gate`) is recorded but **excluded**, so
   a batch that ran dry early doesn't drag the budget down (#553). **The agent can't read the context
   meter — ASK the user for the current reading and use it verbatim; never estimate it. No reading → skip
   calibration** (a guessed value silently skews every future batch's budget).

A batch runs several **agent-ready Tier-A** items in sequence — claim → work → close-out — **without
stopping for approval between them**, to progress faster while still validating at every seam. **The size
of a batch is a points budget, not an item count:** it packs as many points as possible up to
`budget = capacityPoints × targetFraction` (currently `71 × 0.6 ≈ 43`, from
`.claude/skills/batch-backlog-items/capacity.json`), where cost (`item.batchCost`) is a story's `size`
and a task = 2. This fixes the old timidity — a fixed "top 3" cap left a real 10-item batch at only ~20%
context. The **`Suggested batch — points budget`** block from `npm run check:readiness -- --select` (also
`--json` → `batch.picked`) is the pre-computed pack — **read it, don't reconstruct it by hand** (the bug
this fixes: a hand pass found 2 where the loader lists ~23). Batchable = Tier-A **`task`** or
**`story·≤8`** (`item.batchable`); the budget packs **smallest-first**, reaching a single `size·8` only
when the remaining points fit. A `story·≥13` and any `epic` are **never** packed (full eligibility +
fallback in *Running a batch* → *Eligibility*). It
reuses the single-item arc **unchanged**, including **per-item on-disk ownership** (each item is
individually flipped `open → active` with `dateStarted` *before* code, `## Progress` kept in sync,
and `resolved` at close-out after the full gate). The **only** thing it drops is the per-item
chat-rename *stop* — because a batch labels the session **once**.

When invoked (`/batch [P]` or `/batch-next [P] [NNN-slug]`):

1. **Parse args.** A bare number is the **points budget** override `P` (default = the calibrated
   `capacityPoints × targetFraction` from `--select`) — it is a points budget, **not** an item count.
   A `NNN` or `NNN-slug` **seeds** the chain's first item — skip its selection (like next-backlog-item
   step 0); the rest are packed by budget. Both forms may appear (`/batch-next 30 158-editable-grid-typed-editors-validation`).
2. **Plan + approve once, and label the session in the same beat.** Start from
   `npm run check:readiness -- --select` and take its **`Suggested batch — points budget`** pack (already
   ranked + budget-filled). Present it as an **ordered batch plan** (each item with its `live` + `md`
   links, its `batchCost`, and the running total against the budget), per *Running a batch* → *The loop*
   step 1. Your only per-item judgment is the body-fork pre-flight on the packed items (a `story·3` can
   still hide a design call) — not a re-derivation of the pack. **If no Tier-A item exists to seed
   the batch** (the ready pool is empty), there's no batch to run — fall back to `backlog-workflow.md`
   → **"When nothing is agent-ready"**: surface the **single** highest-leverage blocker for the user to
   resolve (the decision that unblocks the most downstream items), discuss it, and stop. Don't open a
   batch on Tier B/C work. In the **same message** (when there *is* a plan), ask the
   user to rename the chat once and emit a `batch-<date>-<NNN>-<NNN>…` slug in its **own fenced code
   block** for the one-click copy — `<date>` plus the planned items' `NNN` numbers in chain order
   (e.g. `batch-2026-06-07-155-164-165`), so two batches on the same day get distinct names. This is
   the *only* rename, and the plan-approval stop protects it from being buried, so there is no
   per-item rename. A single "go" (or one `AskUserQuestion`) authorizes the **whole batch**, not each
   item.
3. **Run the loop.** For each item: the **full single-item arc** — claim → work → close-out gate —
   using the mechanical verbs (`node scripts/backlog.mjs claim <NNN>` to win the race + flip + stamp;
   `… resolve <NNN> [--graduated-to=…]` at close-out; `… scaffold …` for any leftover) so each
   transition is one command, not a hand-edit — updating the **compact ledger** after each
   (one line per item; see *Running a batch* → *Reporting*). The arc carries its upkeep unchanged:
   at claim, **re-evaluate the item's `blockedBy` edges and its digest** (lead paragraph), and on any
   close-out spin-off **set its `blockedBy` + write a digest** — see `backlog-workflow.md` → **"Keep the
   blocker DAG honest"** and **"The digest"**. At every **seam** (after close-out, before claiming the
   next) evaluate the **stop rule**, and **if the planned pack is exhausted with budget + context left,
   top up** by re-running `--select --budget=<remaining>` to absorb any cascade-freed Tier-A items (never
   raw leftovers) — see *Running a batch* → *The loop* step 4.
4. **Stop + hand off** per *Running a batch* → *Stopping*: the final ledger, the **stop reason**
   (which of rules 1–4 fired), and the **carry-forward** block. When the budget was reached with
   eligible work still queued, recommend starting a **fresh agent** so context resets, emitting
   `/batch-next <NNN-slug>` in its own fenced code block.
5. **Calibrate at close-out** per *Running a batch* → *Calibrating the budget*: **ask the user for the
   editor's current context-meter reading** (the agent can't see it), then run
   `node scripts/backlog.mjs calibrate --points=<cost resolved> --context-pct=<reading from user> --stop-reason=<which stop fired>`
   so the budget tracks what a session actually fits — only a capacity-bound stop (`budget`/`context`) trains
   it; a work-bound stop (`empty-pool`/`fork`/`gate`) is excluded (#553) (closing-session does this automatically when a batch ran).
   Never estimate the context percentage; skip calibration if the user gives none.

**The stop rule (solid by construction)** — the **points budget is the sole driver**; stop the batch at a
seam if (and ONLY if) ANY of these **four** holds (full text in *Running a batch* → *The stop rule*):
**gate red _from your own work_** (safety stop — never batch past a red gate *you caused*; but `check:standards`
is whole-repo, so first **diagnose** — read the error lines + `git status`: if every error is in a *concurrent*
session's untracked/external files and none names a file in your changeset, it is **not** your stop — log it and
continue with your independent items, since freezing on another batch's red defeats concurrent batching;
see *The stop rule*), **points budget reached** (deterministic
backstop — the resolved `batchCost` sum fills the budget; every item costs ≥ 2 so it always terminates),
**no eligible Tier-A item left** (`task`/`story·≤8`, *after* the seam re-pack **looped to exhaustion**), or
**a new design fork surfaced** (or an item outgrew its estimate *mid-work* — never on a pre-claim "looks
big" guess; a `story·8` that is genuinely 8 pts has **not** outgrown, the budget decides if it fits).
**There is NO context-seam stop and NO mid-batch context check.** You cannot measure your own context, so
**never stop on your own judgement** ("I've read a lot", "this is long", "I'm at a subsystem boundary" — a
batch that *feels* full has measured at ~22% used), and **never interrupt the batch to ask the user for a
context reading** to decide whether to continue — that re-introduces the judgement stop through the back
door. The budget *already is* the context limit (it's calibrated from a real context-% reading at
close-out). Absent one of the four hard stops, the next action is **always** to claim the next eligible
item. A repo/subsystem boundary is a plan-time *ordering* hint only, never a stop.

**The drop-reason classifier makes rule 3 honest (full table in *The stop rule* → *The drop-reason
classifier*).** A declined item is **not** a stop: every Tier-A item the re-pack surfaces that you don't
claim must carry exactly one hard reason — `taken` (already `status: active` — another session owns it),
`blocked-in-fact` (a needed artifact **verified** absent, *or* a cross-locus item whose repo isn't checked
out so its gate can't run), `not-batchable` (`decision`/`story·≥13`/`epic`), or `outgrew`
(claimed-and-began, then sprawled). **There is NO `out-of-locus` drop reason since #500** — a batch is
locus-agnostic and gates each item in its own locus, so a cross-repo item is claimed and closed like any
other (full mechanic: `backlog-workflow.md` → *Repo-locus*). **There is NO `dirty`/uncommitted drop reason** —
`claim` never inspects git, and a modified-or-untracked working tree is the normal baseline, never a reason
to skip an item. An eligible `task`/`story·≤8` with **none** of these **must be
claimed** — "big / risky / load-bearing / needs a focused session / fresh agent / the tree is dirty" are the gut stops this
kills. The closing ledger **tags every unworked item with its reason**; an untagged item (or one tagged
"felt big") means you stopped early — go back and claim it. Quitting early on a gut call (or an unsolicited
context-check) is the failure this rule exists to kill. (The context-% question belongs at **close-out
only**, for calibration — never as a continue/stop gate.)

Everything per item — claim-as-`active`, the `## Progress` block, the close-out gate and
leftover-capture pass, the immutable-`NNN` rules — is **exactly** the single-item arc. Batch adds
only the loop, the stop rule, and the compact ledger.

## Cascade — linear & semi-linear chains (dependency-ordered batching)

When the batchable pool isn't a set of independent items but a **dependency chain** (B `blockedBy` A,
C by B…), `--select` surfaces only the chain **head** as Tier-A — but that is **not** a one-item batch.
**Cascade batching** works the chain end-to-end: claim the head → resolve → the seam top-up
(`npm run check:readiness -- --select --budget=<remaining>`) pulls the now-unblocked successor into
Tier-A → continue, for as long as budget + a green gate allow. It **never claims a blocked item** — it
claims each the instant its predecessor frees it. This is the same engine as the loop's seam top-up
(step 4), just promoted from exception to primary driver.

- **Linear** — a pure chain, strict dependency order, each close-out frees one successor; the plan *is* the chain.
- **Semi-linear** — a DAG: resolving one item frees several dependents (a storied epic's sibling slices),
  so the eligible **frontier grows** and you pick the next from the *current* frontier each seam.

**Plan it** by tracing the head's transitive dependents and presenting the **anticipated cascade** —
ordered, each link marked `ready now` / `unblocks when #PRED resolves`, with cumulative `batchCost` vs
budget — for **one** "go" (session label spans the chain). Everything else is **unchanged**: full
single-item arc per item, **stop rule at every seam**. A chain link that turns out to be a
**decision/fork** breaks the cascade there (stop rule 4 — its successors stay blocked; surface it and
stop), and only **cascade-freed pre-existing** items continue the run — **never** close-out leftovers.
Throughput order: **`--parallel`** (independent, concurrent) > **serial pack** (independent, sequential) >
**cascade** (dependent, sequential) — the chain can't parallelize, so cascade trades that for running it
unattended in one session instead of as one-item handoffs. Full method:
[backlog-workflow.md](../../../docs/agent/backlog-workflow.md) → **"Linear & semi-linear cascade."**

## Parallel lanes — opt-in `/batch --parallel` (reliability first, speed second)

**The default batch is serial and stays serial.** Everything above is the floor. `--parallel` is a
**speculative optimization layered on top**: it can only ever *speed up a clean batch or fall back to
serial* — it must never trade correctness for throughput. If you're unsure whether to parallelize
*anything*, run serial. A wrong "these don't collide" call corrupts a merge; a wrong "these collide"
call just costs some speed — so **every uncertainty resolves toward serial.**

The non-negotiables (in priority order):

1. **Serial is the safe baseline, always reachable.** Any item that can't be *proven* independent runs
   in the serial chain. Parallelism is opt-in (`/batch --parallel`) and additive — never the default,
   never automatic.
2. **Partition only on provable independence.** Two items may share a parallel **lane boundary** only
   if their **declared file paths are disjoint** *and* neither sits on the other's `blockedBy` edge
   (a DAG edge forces same-lane-after, never concurrent). Overlapping or ambiguous file sets → **same
   lane, serial.** Declared files are treated as a *lower bound*, not the truth (work spills past the
   frontmatter) — which is why git, not the metadata, is the real arbiter (rule 4).
3. **Each lane keeps the full serial arc.** Within a lane, items still run one-after-another through
   claim → work → close-out **gate at every seam**, and the **stop rule** applies per lane. Lanes run
   in **isolated git worktrees** so concurrent edits can't corrupt each other. A red gate in one lane
   contains to that lane — nothing merges until it's individually green.
4. **Git is the conflict detector, not the file declaration.** Merge clean lanes back **one at a
   time**. A merge conflict *is* the proof the partition was wrong — **abort that lane and replay its
   items serially** on top of the merged result. Never force-merge. After all lanes land, run **one
   final gate** (`tests` + `check:standards`) on the merged tree before close-out is final.
5. **No silent speculation.** Report the partition up front (which items in which lane, and *why* each
   pair is independent), and `log` any lane that conflicted and was replayed serially — so a
   fallback reads as a fallback, never as "ran in parallel" when it didn't.

When the ready pool has no provably-disjoint pair (everything touches the same subsystem),
`--parallel` **degenerates to the serial batch** — that's correct, not a failure. The speed win only
materializes when the batchable list genuinely spans independent subsystems; reliability is identical
either way. Full design + rationale: backlog **#083 agent-file-lock-coordination**.
