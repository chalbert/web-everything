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
   + a digest) → `resolve <NNN> [--graduated-to=…]` → **commit the item's files in its lane clone and open a
   ready-to-merge PR** (#2183/#2190): each item is worked in an isolated lane clone (`node scripts/lane-pool.mjs`,
   #2123), so commit only this piece there (`git add <explicit paths>`, never `git add -A`; one commit per
   item), then `node scripts/pr-land.mjs --ref=lane/<batch-slug>-<NNN> --no-wait` — which **applies the
   `ready-to-merge` label automatically** (#2196: the shared transport labels every opened PR; no separate
   `gh pr edit` step).
   **No commit to `main`, no `git push`, no inline merge** — a separate drain (`/merge`/`/drain`) lands the PRs
   (see *backlog-workflow.md → the lane→PR close-out rule*). Update the ledger (header tracks `cost
   <spent>/<budget>`). The `--select`
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
   calibration (closing-session runs it for you otherwise). **Nothing to publish to `main` (#2190).**
   Serial `/batch` no longer commits to `main`: each item landed as an **open ready-to-merge PR** from its lane
   clone (step 3). So the close-out just reports those PRs — land them anytime with `/merge` (or `/drain`); the
   batch neither pushes `main` nor waits on a drain. (Superseded: the old close-out `push-if-green` main-publish
   — under #2183 the producer is no longer a publish site; the drain is the sole one.)

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
to opt-in" path the *Reversible default* note below always reserved). Under **#2183 (slice #2189)** the parallel model is now a **PR fan-out**: every packed item runs in its own
lane clone and finishes as an **open ready-to-merge PR** — there is no partition, no serial lane, and no inline
integrate. Correctness comes from *git as the arbiter*: each item is its own PR, and a separate optional drain
lands them one at a time with rebase-retry, so two items touching one file cost a rebase, never a silent bad
merge. The producer makes **zero commits to `main`** and **never launches or waits on the drain** — it is
correct with no drain running. Use `/batch` (or `--serial`) to skip the orchestrator entirely (e.g. a tiny
pack, or while debugging the batch itself); `/batch`/`/next` still commit inline **until #2190 routes them
through the same lane→PR path**.

**Progress feedback (per item).** The orchestrator runs in the background (the `Workflow` tool), so its
progress streams to **`/workflows`**, not the main chat — the script emits a `log` line at every seam: each
**probe** as it lands (WE-only vs which repos it spans), the **provision** summary, **each item the instant its
PR opens** (✓/~ + gate + PR count), and the **finalize** step. Granularity is **per-item**: every item is its
own `agent()` call in its own lane clone, so you get a line per item. Watch `/workflows` for live progress; the
main chat shows the final ledger (open PRs) on completion.

The non-negotiables (in priority order). *(A "lane" below is **per item**: each item runs alone in its own
persistent **clone** — own HEAD, guard-immune — claims itself there, and pushes to a `lane/*` ref that becomes
a PR head. There is no shared serial lane and no central pre-claim.)*

1. **Every edit lands via a ready-to-merge PR; `main` only moves on merge.** The producer never commits to
   `main`, never integrates inline, and never launches or waits on the drain. A `/workflow` run **completes
   when every item is an open ready-to-merge PR** — full stop. It is correct with **no drain running**.
2. **No partition — every item is its own lane (F2 = drop, reverses #1933).** There is no concurrent-vs-serial
   split and no write-time file-lock layer. With PR-per-item + a drain that serialises with rebase-retry, two
   PRs touching one file just cost the drain a rebase, never a silent bad merge. A light probe survives only to
   detect the non-WE repos an item spans (for pool provisioning + per-repo PRs).
3. **Claim-in-lane; the claim rides the PR.** Each lane resets its clone to `origin/main`, runs
   `backlog.mjs claim` there, works, resolves, writes its `.lane-manifest.json`, commits, pushes `lane/*`, and
   opens the PR. Because the claim + resolve ride the PR, an item that fails in-lane is **never left `active`
   on `main`** — so there is no closeout "reopen unlanded" step here. A lane whose scoped fast-fail is red
   opens **no PR** (it is carried, recoverable).
4. **Git is the conflict detector — but at *drain* time, not here.** The producer just fans out PRs. The
   separate `/drain` (`we:scripts/lane-drain.mjs`) merges them one at a time with rebase-retry, impl-first/
   WE-last per couple, and does the id-collision heal + derived regen + reopen-on-fail at landing.
5. **No silent speculation.** Every probe verdict, every opened/failed PR, and the local ready-to-merge signal
   are `log`ged per item — so a carried item reads as carried, never as "landed."

The speed win is the fan-out; the safety is git-at-drain-time. Full design + rationale: backlog **#2183** and
its slices **#2189/#2190/#2187/#2188**.

### Execute phase runs on the Workflow tool — the #2183 PR-fan-out model (#2189)

The **main loop still does the conversational part unchanged** — pack, plan, the single "go", the reserve,
and the close-out/calibration. Under `/workflow` (or `--parallel`) it then hands the **execute phase**
to the `Workflow` tool, which enforces the non-negotiables above deterministically:

```
const r = Workflow({
  scriptPath: ".claude/skills/batch-backlog-items/parallel-execute.workflow.js",
  args: { batchSlug, budgetPoints, primaryRoot, items: [ { num, slug, file, locus, cost, declaredFiles, blockedBy } … ] },
})
```

**Why clones (#1153 4th-run finding).** The user-global git-branch guard denies both `worktree add` and branch
creation in the shared checkout, so **each lane is its own persistent CLONE with its own HEAD**
(`we:scripts/lane-pool.mjs`), and convergence happens **through the remote** — a lane pushes to a `lane/*` ref
(the #1934 guard carve-out) that becomes a PR head.

The script (read its header for the full contract): a **light probe** (which non-WE repos each item spans —
no touch-set/partition) → **provision** a lane pool per affected repo + create the `ready-to-merge` label once
(**no pre-claim, no base ref, no commit to `main`**) → `parallel()` **one agent per item in its own lane clone**
(`cd <lane>` → `reset --hard origin/main` → `backlog.mjs claim` there) that works its own files, gates locally
with `check:standards --local --files=…` (#1937 best-effort fast-fail), resolves, writes its
`.lane-manifest.json`, commits explicit paths, pushes `HEAD:lane/<slug>-<n>` per repo, and **opens a
ready-to-merge PR per ref** via `pr-land --no-wait` + the label → **finalize** writes a local (uncommitted)
`queued.json` signal per PR'd item (so the same checkout won't re-offer them, and the existing `/drain` can
land them today). It returns `{ ledger, itemsWorked, prsOpened, prUrls, queued, crossRepoItems,
reposProvisioned, probeFailures, … }` — **no landed state**; the result is a set of **open ready-to-merge
PRs** a separate drain lands.

**Cross-repo lanes — the constellation (#96: WE → frontierui → plateau-app).** A single item's impl can span
repos. The backlog item + its resolve **always live in WE**; the light probe reports any **non-WE repos** it
touches (`extraRepos`), and the orchestrator **provisions a lane pool per affected repo** (`lane-pool.mjs` is
repo-parameterized), dispatches the item across its **coupled clones**, pushes `lane/<slug>-<n>` to **each
repo's own origin**, and **opens one PR per repo**. **Cross-repo atomicity is the drain's job**, by *ordering*:
the WE PR carries the item's `.lane-manifest.json` naming the repos **impl-first/WE-last**, and the drain lands
them in that order so a failed impl merge never leaves a false `resolved` (WE carries the `active→resolved`
flip and lands last).

**The producer opens PRs — it does NOT land anything.** After a green return the main agent has **no git
landing op**: it folds `r.ledger` into the standard closure block, surfaces `r.prUrls` (the open ready-to-merge
PRs) + any `carried` items, and stops. Landing is a **separate, optional** `/drain` (or `/merge`) run — the
producer is correct with none running. If `r` reports `aborted`, **don't trust the run** — surface it and fall
back to a serial `/batch`.

**What the registry split (#1145/#1146) changed:** shared registries are per-entry files
(`src/_data/<reg>/<id>.json`), so a lane that adds/edits a registry entry just writes its OWN file — disjoint,
merges clean. Genuinely-monolithic shared docs (`AGENTS.md`, single-doc registries) are still merge-risk, but
that risk is now handled at **drain** time (rebase-retry) rather than by a producer-side partition/lock.

> **Opt-in, reversible.** Parallel is reached via `/workflow` (or `--parallel`); `/batch` stays linear. The
> **closing-session skill audits each run** (open ready-to-merge PRs, carried items, gate). The command split
> *is* the agreed opt-in stance: linear is the safe default you reach for, parallel is the explicit `/workflow`
> choice. (Earlier this was a `--parallel`-off default flipped to default-on under #1147, then re-split into
> `/workflow`; #2183 further makes the parallel path a PR fan-out — same reversible opt-in underneath.)
