---
name: batch-backlog-items
description: Work several small, agent-ready backlog items back-to-back in one session, with a validation gate at every seam and a hard stop that guarantees it ends. Use when the user wants to "batch" backlog items, run a few small items in a row, or progress faster without stopping between each. For a single item, use next-backlog-item instead.
---

# Batch — work several small backlog items back-to-back

Trigger + pointer — the method lives in
[docs/agent/backlog-workflow.md](../../../docs/agent/backlog-workflow.md) (**"Running a batch"**,
which builds on **"Selecting the next item to work on"**, **"Working an item"**, and **"Closing out a
completed item"**). Don't restate the rubric here; if the method changes, edit that doc.

A batch runs several **small Tier-A** items in sequence — claim → work → close-out — **without
stopping for approval between them**, to progress faster while still validating at every seam.
"Small" is **explicit**, read off the *Agile sizing* fields: a **`story` of `size` ≤ 3** or any
**`task`**; a `story` of `size` ≥ 5 and any `epic` are **never** batched (full eligibility +
fallback in *Running a batch* → *Eligibility*). It
reuses the single-item arc **unchanged**, including **per-item on-disk ownership** (each item is
individually flipped `open → active` with `dateStarted` *before* code, `## Progress` kept in sync,
and `resolved` at close-out after the full gate). The **only** thing it drops is the per-item
chat-rename *stop* — because a batch labels the session **once**.

When invoked (`/batch [N]` or `/batch-next [N] [NNN-slug]`):

1. **Parse args.** A bare number is the cap `N` (default **3**). A `NNN` or `NNN-slug` **seeds** the
   chain's first item — skip its selection (like next-backlog-item step 0); the rest are picked by
   ranking. Both forms may appear (`/batch-next 5 158-editable-grid-typed-editors-validation`).
2. **Plan + approve once, and label the session in the same beat.** Run *Selecting* but present an
   **ordered batch plan** of up to `N` small Tier-A items (each with its `live` + `md` links and a
   one-line rationale), per *Running a batch* → *The loop* step 1. **If no Tier-A item exists to seed
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
3. **Run the loop.** For each item: the **full single-item arc** — claim (with the concurrency
   re-read to win the race) → work → close-out gate — updating the **compact ledger** after each
   (one line per item; see *Running a batch* → *Reporting*). At every **seam** (after close-out,
   before claiming the next) evaluate the **stop rule**.
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
