---
name: batch-backlog-items
description: Work several small, agent-ready backlog items back-to-back in one session, with a validation gate at every seam and a hard stop that guarantees it ends. Use when the user wants to "batch" backlog items, run a few small items in a row, or progress faster without stopping between each. For a single item, use next-backlog-item instead.
---

# Batch — work several small backlog items back-to-back

Trigger + pointer — the method lives in
[docs/agent/backlog-workflow.md](../../../docs/agent/backlog-workflow.md) (**"Running a batch"**,
which builds on **"Selecting the next item to work on"**, **"Working an item"**, and **"Closing out a
completed item"**). Don't restate the rubric here; if the method changes, edit that doc.

Invoked as `/batch [P]` or `/batch-next [P] [NNN-slug]`: a bare number `P` overrides the **points
budget** (not an item count; default = the calibrated `capacityPoints × targetFraction`); a `NNN`/`NNN-slug`
**seeds** the chain's first item (skip its selection). **Open `backlog-workflow.md` only for an edge case**
(empty pool → surface one decision; a stop-rule judgment call); the happy path is the loop below. A batch
reuses the single-item arc **unchanged** (per-item `open → active` + `dateStarted` before code, `## Progress`
synced, `resolved` after the full gate); it adds only the loop, the stop rule, and the ledger, and drops only
the per-item chat-rename — a batch labels the session **once**.

## The loop

1. **Pack** — `npm run check:readiness -- --select --session=<batch-slug>` → take its `Suggested batch —
   points budget` block (also `--json` → `batch.picked`). **Read it, don't reconstruct it** — the loader
   budget-fills the ranked Tier-A list to `capacityPoints × targetFraction` (cost = a story's `size`, a
   task = 2; packs **smallest-first**; **count = whatever fits**; `item.batchable` = Tier-A `task`/`story·≤8`,
   and a `story·≥13`/`epic` is **never** packed). A `NNN`-seed fixes the first item; the rest pack by budget.
   - **Pre-flight = skim the packed bodies for a buried fork — that's the whole judgment.** Trust the
     projection (only `blockedBy`-resolved items appear — don't re-grep blockers; never read `git status`
     for eligibility, a dirty tree is the baseline and `claim` ignores it). Clean pack → go; look one cluster
     deeper only if the skim surfaces a fork.
   - **Mis-flagged item → fix the flag in place, don't skip it** — retype `type: decision` (→ Tier B), set
     `status: parked`, or bump `size` to `13` (drops it from the pool), then re-run. The skim is
     principle-conformance, not just a fork check (#608): a stale `file:line`, false premise, or missing
     placement note → **remediate in place** (pure-agent only — never quietly make a design call to force
     batchability); escalate only an irreducible fork as a ready-to-ratify nod. (`npm run check:health`
     surfaces deterministic governance/ref flags worth a glance before a long run.)
   - **Pool can't fill the budget → the batch is just shorter** (stop rule 3); don't pad with `≥13`/`epic`
     work — those stay single-item (the *Other Tier-A* list).
2. **Plan + one "go" + label once** — present the pack as an ordered plan (each item: `live` + `md` links,
   `batchCost`, running total vs budget). Your only per-item judgment is the body-fork pre-flight, not a
   re-derivation. In the **same message**, emit the single rename slug `batch-<date>-<NNN>-<NNN>…` (chain
   order, distinct per day) in its **own fenced block** — the *only* rename. One "go" authorizes the **whole
   batch**. **On the "go", soft-hold the pack:** `node scripts/backlog.mjs reserve <NNN...> --session=<batch-slug>`
   (a concurrent batch then packs around your items — deprioritized, not excluded, #083); pass
   `--session=<batch-slug>` to **every** `--select` (open + top-ups) so your own holds don't sink your chain.
   - **Empty pool → no batch.** Fall back to *backlog-workflow.md → "When nothing is agent-ready"*: surface
     the **single** highest-leverage blocker, discuss, stop. Don't open a batch on Tier B/C work.
3. **Loop, per item — the full arc, one command per transition:** `claim <NNN>` (wins the race + flips +
   stamps; at claim **re-evaluate its `blockedBy` edges + digest**) → work (keep `## Progress` synced) →
   **gate in the item's own locus** (look up `LOCI[item.locus]` in `check-standards-rules.mjs`: run
   `gateCommand` in `repoPath`, probe `devServerProbe` for any render check, do any `closeoutDiscipline`;
   a WE item is just `npm run check:standards`). **Pass `--scope=<batch-slug>` to the WE gates** —
   `npm run check:standards -- --scope=<batch-slug>` (file-keyed, #952) and `npm run check:health --
   --scope=<batch-slug>` (id-keyed, #957) both demote *concurrent* sessions' findings to non-failing notes
   and surface only your changeset, so the gate-red diagnosis below is deterministic, not a manual `grep
   errors + git status` triage. → capture leftovers via `scaffold …` (set their `blockedBy`
   + a digest) → `resolve <NNN> [--graduated-to=…]` → **commit that item's files to its `commitTarget` repo**
   (`git add <explicit paths>` then `git commit` — stage only this piece, never `git add -A`, never
   `git push`; one commit per item; if your own file is dirty from a concurrent session, `git stash push --
   <file>` → edit → commit → pop). Update the ledger (header tracks `cost <spent>/<budget>`). The `--select`
   pack prints a per-locus gate legend (`⌂ <locus> → <gateCommand> in <repoPath>`). See *backlog-workflow.md
   → Reporting / Keep the blocker DAG honest / The digest*.
4. **At each seam, evaluate the stop rule** (below). On continue, re-read the next item fresh (drop only if
   now `status: active` — another session owns it; uncommitted edits are never a drop reason). **Pack dry but
   budget left → top up:** re-run `--select --budget=<remaining>` (= budget − resolved `cost`) to absorb
   cascade-freed Tier-A items — **never** a close-out leftover (unvetted: capture and leave). Budget is a
   ceiling, not a quota: re-pack finds nothing → stop short.
5. **Stop → close out:** release holds (`node scripts/backlog.mjs unreserve --session=<batch-slug>` — unworked
   reserves flow back; `claim` already dropped the worked ones), then emit the **standard closure block**
   (*backlog-workflow.md → Stopping*): the fixed terse shape — header (`cost X/budget · stop: <rule>`), one
   `✓`/`~`/`→` line per item (carry-forwards tagged with a drop-reason), the Next line, the single calibration
   line. **No bespoke essay**; expand only for a red gate or on request. **Calibrate:** the closure's last
   line is always the standard ask **verbatim** — `Context %? — for calibrate; skip if you can't read it.`
   (never the `AskUserQuestion` popup, never re-ask/block/guess) — then `node scripts/backlog.mjs calibrate
   --points=<cost resolved> --context-pct=<reading> --stop-reason=<which stop>`. Only a capacity stop
   (`budget`/`context`) trains the estimate; work-bound (`empty-pool`/`fork`/`gate`) is recorded but
   **excluded** (#553). No reading → **skip** calibration (closing-session runs it for you otherwise).

**The stop rule (solid by construction)** — the **points budget is the sole driver**; stop the batch at a
seam if (and ONLY if) ANY of these **four** holds (full text in *Running a batch* → *The stop rule*):
**gate red _from your own work_** (safety stop — never batch past a red gate *you caused*; but `check:standards`
is whole-repo, so first **diagnose** — fastest via `--scope=<batch-slug>` on both WE gates (#952/#957), which
auto-demotes concurrent findings; or manually read the error lines + `git status`: if every error is in a
*concurrent* session's untracked/external files and none names a file in your changeset, it is **not** your stop
— log it and continue with your independent items, since freezing on another batch's red defeats concurrent
batching; see *The stop rule*), **points budget reached** (deterministic
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
other (*backlog-workflow.md → Repo-locus*). **There is NO `dirty`/uncommitted drop reason** —
`claim` never inspects git, and a modified-or-untracked working tree is the normal baseline, never a reason
to skip an item. An eligible `task`/`story·≤8` with **none** of these **must be
claimed** — "big / risky / load-bearing / needs a focused session / fresh agent / the tree is dirty" are the gut stops this
kills. The closing ledger **tags every unworked item with its reason**; an untagged item (or one tagged
"felt big") means you stopped early — go back and claim it. Quitting early on a gut call (or an unsolicited
context-check) is the failure this rule exists to kill. (The context-% question belongs at **close-out
only**, for calibration — never as a continue/stop gate.)

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
unattended in one session instead of as one-item handoffs. Full method: *backlog-workflow.md → Linear
& semi-linear cascade*.

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
