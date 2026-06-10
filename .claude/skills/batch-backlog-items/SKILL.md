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

1. **`npm run check:readiness -- --select`** → its **batchable** list is the pool, already ranked. Take
   the top `N` (default 3). Skim only those `N` bodies for a buried fork — **that's the whole
   pre-flight.** Trust the projection: it only lists items with `blockedBy` resolved, so **don't
   re-`grep` already-resolved blockers**; a dirty-file flag means **drop or defer to `claim`**, not
   `git diff` it; and **only look one cluster deeper for a tighter alternative if the skim actually
   surfaces a fork** — clean top-N → take it and go (full rule: *Running a batch* → *Eligibility* pre-flight note).
2. **Present the ordered plan, get one "go"**, and emit the single `batch-<date>-<NNN>-<NNN>…` rename
   slug (the batch labels the session **once** — no per-item rename).
3. **Loop, per item:** **`node scripts/backlog.mjs claim <NNN>`** → work → gate (tests + `npm run
   check:standards`) → leftovers via **`node scripts/backlog.mjs scaffold …`** → **`node scripts/backlog.mjs
   resolve <NNN> [--graduated-to=…]`**. Update the compact ledger after each.
4. **At each seam, evaluate the stop rule**; on continue, re-read the next item fresh (drop it if now
   `active`/dirty). Stop → final ledger + stop reason + carry-forward.

A batch runs several **small Tier-A** items in sequence — claim → work → close-out — **without
stopping for approval between them**, to progress faster while still validating at every seam.
"Small" is **explicit and pre-computed** — the loader's `item.batchable` flag, which
**`npm run check:readiness -- --select` prints as a ready list** (also `--json` → `selection.batchable`),
identical to the `/backlog/` Prioritisation tab. **That list is your candidate pool — read it, don't
reconstruct it by hand** (the bug this fixes: a hand pass found 2 where the loader lists ~23). The rule
behind the flag: a **`story` of `size` ≤ 3** or any **`task`**; a `story` of `size` ≥ 5 and any `epic`
are **never** batched (full eligibility + fallback in *Running a batch* → *Eligibility*). It
reuses the single-item arc **unchanged**, including **per-item on-disk ownership** (each item is
individually flipped `open → active` with `dateStarted` *before* code, `## Progress` kept in sync,
and `resolved` at close-out after the full gate). The **only** thing it drops is the per-item
chat-rename *stop* — because a batch labels the session **once**.

When invoked (`/batch [N]` or `/batch-next [N] [NNN-slug]`):

1. **Parse args.** A bare number is the cap `N` (default **3**). A `NNN` or `NNN-slug` **seeds** the
   chain's first item — skip its selection (like next-backlog-item step 0); the rest are picked by
   ranking. Both forms may appear (`/batch-next 5 158-editable-grid-typed-editors-validation`).
2. **Plan + approve once, and label the session in the same beat.** Start from
   `npm run check:readiness -- --select` — its **batchable** list is the pool, already ranked; take the
   top `N` from it. Present an **ordered batch plan** of up to `N` small Tier-A items (each with its
   `live` + `md` links and a one-line rationale), per *Running a batch* → *The loop* step 1. Your only
   per-item judgment is the body-fork pre-flight on those `N` (a `story·3` can still hide a design call)
   — not a re-derivation of the whole batchable set. **If no Tier-A item exists to seed
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
   next) evaluate the **stop rule**.
4. **Stop + hand off** per *Running a batch* → *Stopping*: the final ledger, the **stop reason**
   (which rule fired), and the **carry-forward** block. When the stop was the **context seam**,
   recommend starting a **fresh agent** so context resets, emitting `/batch-next <NNN-slug>` in its
   own fenced code block.

**The stop rule (solid by construction)** — stop the batch at a seam if ANY holds (full text in
*Running a batch* → *The stop rule*): **gate red** (safety stop — never batch past a red gate),
**count cap reached** (deterministic backstop — always terminates by `N`), **no eligible small
Tier-A item left**, **a new design fork surfaced** (or an item outgrew its "small" assumption), or a
**context seam** (self-assessed; can only stop *earlier*, never extend). The cap guarantees the batch
ends regardless of the softer calls — that is what makes running longer safe.

Everything per item — claim-as-`active`, the `## Progress` block, the close-out gate and
leftover-capture pass, the immutable-`NNN` rules — is **exactly** the single-item arc. Batch adds
only the loop, the stop rule, and the compact ledger.

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
