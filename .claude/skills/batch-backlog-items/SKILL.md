---
name: batch-backlog-items
description: Work several small, agent-ready backlog items back-to-back in one session, with a validation gate at every seam and a hard stop that guarantees it ends. Use when the user wants to "batch" backlog items, run a few small items in a row, or progress faster without stopping between each. For a single item, use next-backlog-item instead.
---

# Batch — work several small backlog items back-to-back

Trigger + pointer — the method lives in
[docs/agent/backlog-workflow.md](../../../docs/agent/backlog-workflow.md) (**"Running a batch"**,
which builds on **"Selecting the next item to work on"**, **"Working an item"**, and **"Closing out a
completed item"**). Don't restate the rubric here; if the method changes, edit that doc.

Invoked as `/batch [P]`, `/batch-next [P] [NNN-slug]`, or `/workflow [P] [NNN-slug]`: a bare number `P`
overrides the **points budget** (not an item count; default = the calibrated `capacityPoints × targetFraction`);
a `NNN`/`NNN-slug` **seeds** the chain's first item (skip its selection). **The command picks the execute
model:** `/batch` + `/batch-next` run the **linear / serial inline loop** (the default); **`/workflow` runs the
parallel orchestrator** (provably-disjoint lanes on the `Workflow` tool — see *Parallel lanes* below). The
`--parallel` / `--serial` flags are explicit per-invocation overrides on either command. **Open
`backlog-workflow.md` only for an edge case**
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
     `status: parked`, bump `size` to `13` (drops it from the pool), or — when the only residual is a
     **human-only action** an agent can't do (credentialed deploy/secret, agent-training feedback, external
     setup, a human review) — add a `humanGate: { kind, what }` (`kind ∈ deploy|credential|feedback|review|setup`;
     *backlog-workflow.md → Human gate*), which demotes it out of Tier A exactly like a pending project. Then
     re-run. A buried **dependency** must be encoded as a real `blockedBy` edge (file the prerequisite item if
     it doesn't exist) — never left as a prose note the selector can't see; a human residual gets a `humanGate`,
     **not** a `blockedBy` to a phantom node. `taken` (a live reservation) is the one reason that needs no data
     fix — it already shows a pill on the tab. The skim is principle-conformance, not just a fork check (#608):
     a stale `file:line`, false premise, or missing placement note → **remediate in place** (pure-agent only —
     never quietly make a design call to force batchability); escalate only an irreducible fork as a
     ready-to-ratify nod. (`npm run check:health` surfaces deterministic governance/ref flags worth a glance
     before a long run.)
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
   stamps; at claim **re-evaluate its `blockedBy` edges + digest**) → work (keep `## Progress` synced, and
   keep **one** `in_progress` todo phrased as a present-tense status — it's the card's live *currently-doing*
   on the /backlog Active-work tab, see *Working an item* → *Keep it in sync*) →
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
   line. **No bespoke essay**; expand only for a red gate or on request. **Calibrate — SERIAL `/batch` ONLY:**
   calibration maps a context-% reading → points resolved, which only holds when the **main loop does the
   work**. A `/workflow` (parallel) batch resolves its points in **subagent contexts** (worktree lanes), so
   the orchestrator's context-% measures only pack/plan/land overhead — it is **decoupled** from throughput
   and a reading there is meaningless (and would pollute the estimate). So for **`/workflow` (parallel): SKIP
   calibration entirely** — no context-% ask, no `calibrate` call; its ceiling is the token/agent budget, not
   context. For **serial `/batch`**, calibrate as normal: the closure's last line is the standard ask
   **verbatim** — `Context %? — for calibrate; skip if you can't read it.` (never the `AskUserQuestion` popup,
   never re-ask/block/guess) — then `node scripts/backlog.mjs calibrate --points=<cost resolved>
   --context-pct=<reading> --stop-reason=<which stop>`. Only a capacity stop (`budget`/`context`) trains the
   estimate; work-bound (`empty-pool`/`fork`/`gate`) is recorded but **excluded** (#553). No reading → **skip**
   calibration (closing-session runs it for you otherwise).

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

## Parallel lanes — the `/workflow` orchestrator (opt-in; `/batch` stays linear) (reliability first, speed second)

**`/workflow` (or `--parallel`) runs the parallel execute model; `/batch` runs the inline serial loop (the
default).** Parallel was once the default (#1147) but has been **re-split into its own command** so the choice
is explicit per invocation — `/batch` for linear, `/workflow` for parallel (this is the documented "flip back
to opt-in" path the *Reversible default* note below always reserved). It stays **reversible** — the close-skill
audit is the watch. The guarantee is unchanged: parallel can only ever *speed up a clean batch or fall back to
serial* — it must never trade correctness for throughput. **Every uncertainty still resolves toward serial:** a
wrong "these don't collide" call risks a merge; a wrong "these collide" call just costs some speed. So the
probe forces any low-confidence item into the serial lane, and when no provably-disjoint pair exists the whole
batch **degenerates to serial** (correct, not a failure). Use `/batch` (or `--serial`) to skip the orchestrator
entirely (e.g. a tiny pack, or while debugging the batch itself).

**Progress feedback (per item).** The orchestrator runs in the background (the `Workflow` tool), so its
progress streams to **`/workflows`**, not the main chat — the script emits a `log` line at every seam: each
**probe** as it lands (with its concurrent/serial verdict), the **partition roster**, **each item the instant
its agent resolves** (✓/~ + gate + status), and every **merge / replay / derived-regen** step. Granularity is
**per-item**: every item is its own `agent()` call (concurrent items each in their own worktree; serial-lane
items one-at-a-time on the branch), so you get a line per item, not per multi-item lane. Watch `/workflows`
for live progress; the main chat shows the final ledger on completion.

The non-negotiables (in priority order). *(A "lane" below is now **per item**: each concurrent item runs alone
in its own worktree, and the serial lane is worked one item at a time — so "lane of N" reads as "N independent
items." The guarantees are unchanged; only the granularity got finer.)*

1. **Serial is the safe baseline, always reachable.** Any item that can't be *proven* independent runs
   in the serial chain, and `/batch` (or `--serial`) forces the whole batch onto it. Parallelism (`/workflow`)
   is a layer *on top of* that baseline — it never replaces it: the serial lane is always where uncertainty
   lands, so even an all-`/workflow` run can only speed up a provably-clean partition, never weaken the floor.
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
`/workflow` **degenerates to the serial batch** — that's correct, not a failure. The speed win only
materializes when the batchable list genuinely spans independent subsystems; reliability is identical
either way. Full design + rationale: backlog **#083 agent-file-lock-coordination**.

### Execute phase runs on the Workflow tool (#1147)

The **main loop still does the conversational part unchanged** — pack, plan, the single "go", the reserve,
and the close-out/calibration. Under `/workflow` (or `--parallel`) it then hands the **execute phase**
to the `Workflow` tool, which enforces the five non-negotiables above deterministically:

```
const r = Workflow({
  scriptPath: ".claude/skills/batch-backlog-items/parallel-execute.workflow.js",
  args: { batchSlug, budgetPoints, items: [ { num, slug, file, locus, cost, declaredFiles, blockedBy } … ] },
})
```

The script (read its header for the full contract): per-item **effect-probe** (frontmatter files are a
lower bound, so an agent predicts the real touch-set; low-confidence → forced serial) → pure-JS **partition**
into a **serial lane** (probe-uncertain, monolith-touching, or anything sharing files / a `blockedBy` edge
with another item) + a **concurrent set of provably-independent items** (each disjoint from *every* other
item) → `parallel()` **one agent per concurrent item in `isolation:'worktree'`** (per-item granularity — each
item logs as it lands) that gates locally with `check:standards --local --files=…` (#1144) → a serial
**integrate** loop that works the serial lane first (one agent per item on the branch), then merges each
clean worktree one at a time **onto a throwaway integration branch**, runs the **full** gate per merge, and
**replays a conflicted/red item serially** (the JS loop's single thread is the merge mutex) → regenerates
**derived artifacts once**. It returns `{ integrationBranch, ledger, concurrentItems, serialItems,
multiLaneFiles, conflictsReplayed, … }`. **One agent per item** is what gives `/workflows` a progress line as
each item resolves (the earlier model bundled several items into one lane agent and reported once).

**The main agent does the landing** (not the workflow — the workflow NEVER writes the live branch). After a
green return, merge the integration branch onto the working branch in ONE op, then delete it:

```
git merge --no-ff batch-parallel/<slug>     # the single write to the live branch; resolve once if a
                                            # concurrent session moved it. If it conflicts/red → don't
                                            # land; surface and fall back to a serial replay.
git branch -D batch-parallel/<slug>
```

This is the safety win: every risky multi-actor git write is quarantined to worktrees + the throwaway
branch; the shared branch sees exactly **one** merge, with a natural **abort point** (a bad assembly never
touches your branch) and per-item commit history preserved. Fold `r.ledger` into the standard closure block,
and **surface `r.multiLaneFiles`** (files touched by >1 lane — the residual silent clean-but-wrong-merge
risk) for a human glance; the close-skill audit re-checks them.

**What the registry split (#1145/#1146) changed:** shared registries are now per-entry files
(`src/_data/<reg>/<id>.json`), so a lane that adds/edits a registry entry just writes its OWN file — disjoint,
merges clean, **no integrator-applied manifest** (and `multiLaneFiles` is usually empty). The lane
**effects-manifest** is therefore narrow: it only covers what a lane must *not* commit itself — **derived
artifacts** (`AGENTS.md`, `referenceIndex.json`, regenerated once by the integrator) and rare edits to a
still-**monolithic** low-churn registry (projects/capabilities/adapters/capabilityMatrix/designSystems).

> **Opt-in, reversible.** Parallel is reached via `/workflow` (or `--parallel`); `/batch` stays linear. The
> machinery has **not** yet been proven by a real multi-lane run (#1153) — the first real parallel batches are
> the live validation, and the **closing-session skill audits each one** (lanes, conflicts replayed,
> `multiLaneFiles`, derived regen, final gate). The command split *is* the agreed opt-in stance: linear is the
> safe default you reach for, parallel is the explicit `/workflow` choice. (Earlier this was a `--parallel`-off
> default flipped to default-on under #1147; it has now been re-split into `/workflow` so the choice is
> explicit rather than a flag — superseding that default-on stance, same reversible machinery underneath.)
