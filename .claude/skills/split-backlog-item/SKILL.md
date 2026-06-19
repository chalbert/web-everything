---
name: split-backlog-item
description: Analyse large backlog stories (size > 8) and split each into smaller, agent-ready, independently-deliverable batchable slices — but only when it's provably safe and doesn't cost quality. Always produces a report of what could and could not be split (with the action that would unblock the latter); the on-disk split is gated on approval. Use when the user wants to "split" a big story, break a large item into smaller ones, or find which backlog items are too big to batch.
---

# Split — slice large stories into batchable items, only when safe

Trigger + pointer — the method lives in *backlog-workflow.md → Splitting a large story*, which builds on
*backlog-workflow.md → Agile sizing*, *backlog-workflow.md → Selecting the next item to work on*,
*backlog-workflow.md → Running a batch → Eligibility*, and *backlog-workflow.md → Keep the blocker DAG
honest*. Don't restate the rubric here; if the method changes, edit that doc.

The governing instinct is **conservative**: a needless split fragments one coherent deliverable into
pieces that only make sense together (quality loss, more review overhead, zero gain); a missed split just
leaves a big item to single-pass later. When a clean seam isn't obvious, don't split — record it as *could
not split* with the unblocking action, and move on.

## Quick path — the loop in commands

1. **Build the candidate set** — two kinds: (a) oversized stories (`workItem: story`, `size` > 8 / `13`)
   and (b) unsliced epics (`workItem: epic` with no children — no item names them as `parent`). An epic is
   already decided to decompose, so it skips the should-we-split question (rubric (1)) and seeds slices
   from its body — but still verifies them against the real tree in step 2. **Slice granularity:** an
   epic's slices are *normally* stories/tasks, **but** a **roadmap / "epic of epics"** (every natural child
   is itself a multi-story scope — a registry of N independently-fundable standards/subsystems, each "an
   impl epic") slices into **sub-epics**, carved one level down — each then a future `/slice` candidate
   (slicing is recursive). Tell: each child is *clearly* epic-sized, not a `≤5` story band. For sub-epic
   slices, rubric (3)/(5) take the epic form ((3′)/(5′) in *backlog-workflow.md → The split-safety
   rubric*): each is a coherent independently-ownable scope carrying its **resolved design lineage** as
   seed (not a demoable leaf); design-gated / true-GAP rows stay could-not-split-here behind their upstream
   decision, so a roadmap epic typically yields a **partial** sub-epic split. Unblocked stories come from
   `npm run check:readiness -- --select` (`--json` → `selection.tierA`/`selection.tierB`, filter
   `workItem==='story' && size>8`). Blocked stories and epics aren't in that projection, so do a one-pass
   frontmatter scan of `backlog/*.md` (`workItem: story` + `size` ≥ 13, **or** `workItem: epic` with no
   child referencing it, all `status` ≠ `resolved`) for the complete list. `/split <NNN>` (alias `/slice
   <NNN>`) focuses one item; bare `/split` sweeps the whole set.
2. **Investigate the real work before proposing any slice** (*backlog-workflow.md → The
   work-investigation pass*). A slice boundary is a claim about the code — so read the code before drawing
   it. Grep/Explore the subsystem(s) the item touches (files, call sites, registries, fixtures) and find
   where the seams *actually* fall, not where the body's framing implies. Each proposed slice's named
   files must be `file:line`-citable from what you read and its `size` re-estimated against the real
   surface. For an unsliced epic, its body's decomposition is the *seed*, not the answer — verify each
   slice against the tree. If the work can't be investigated to that depth (surface doesn't exist yet,
   scope unknown until a foundational piece lands) → **could not split**, action: *land/investigate
   foundational slice A first*. Never propose slices "straight from the body" — that's guessing the seams.
3. **Apply the split-safety rubric to each** (all five must hold — *backlog-workflow.md → The
   split-safety rubric*). Any failure → **could not split**.
4. **Write the report** `reports/<YYYY-MM-DD>-backlog-split-analysis.md` — two tables: could-split (per
   candidate: proposed slices with re-estimated `size`/`workItem`, the slice DAG, which are batchable) and
   could-not-split (per candidate: *which rubric condition failed* + the specific unblocking action that
   would make it splittable later — *resolve decision X*, *land foundational slice A first*, *author shared
   fixture F*, *re-scope as an unstoried epic until Y ships*). The report is produced even when zero items
   split. Register any "could not split, pending decision X" back in the backlog as a Tier-B item, and file
   a blocking fork as its own `type:decision` card even when deferred (deferral parks the card `status:
   parked`, it never licenses leaving the fork buried in the parent's body — *backlog-workflow.md → Where
   an open question goes*; [[feedback_decisions_are_workitems_not_plan_mode]]). De-bury the parent: replace
   its inline fork with a pointer to the card.
5. **Stop and present.** Report the analysis. For each splittable candidate, show the proposed slices +
   DAG and ask for one "go" before mutating anything — the report is the deliverable; the on-disk mutation
   is gated on approval, do not auto-split.

## Executing a split — only after approval

A single "go" authorizes the splits you presented. Per approved item, mechanically
(*backlog-workflow.md → Executing a split*):

1. **Convert the original `NNN` in place → a *storied* epic.** Splice `workItem: story` → `epic`, remove
   `size` (children carry the points now), refresh its digest to an umbrella framing, keep `status: open`,
   and keep the `NNN` — never renumber (*backlog-workflow.md → Rules*). *Edge case:* if the original
   already has a `parent`, don't nest — keep it a re-sized `story` for its core slice and add the rest as
   siblings under the same parent. *Already an epic (kind b):* no conversion — but still drop any residual
   `size` (a mis-converted epic that kept story points double-counts once it has sized children —
   `check:standards` errors), refresh the digest only if needed, and go straight to scaffolding its child
   slices.
2. **Scaffold each slice:** `node scripts/backlog.mjs scaffold --type=… --workitem=story|task
   [--size=…] --title="…" --parent=<NNN> [--blocked-by=<NNN>,…] --digest="…"`. **Sub-epic slice** (roadmap
   mode): scaffold `--workitem=epic` with **no `--size`**, and seed its body with the row's design lineage
   so it's a real future `/slice` candidate, not an empty shell. `--parent` rolls it under
   the epic; `--blocked-by` lays the DAG edges; write a real per-slice digest (it's the loader's
   `summary`).
3. **Gate:** `npm run check:standards` green (it errors on a storied epic that kept a `size`, an
   unresolvable `parent`/`blockedBy`, a cyclic edge, or a missing digest), and confirm the backlog count
   rose by the number of slices (proves each new file parsed — mind the hot-reload footgun in *Closing
   out* step 2). Re-evaluate `blockedBy` per *backlog-workflow.md → Keep the blocker DAG honest*.

A split opens slices and converts one item — it never `resolve`s the original (its scope now lives in the
children) and never deletes anything. Close with a net-flow line (`+<slices>`, original → epic) and, since
the slices are freshly batchable, point at `/batch` to chain them.

## Relationship to `/batch`

Split is the upstream feeder for `/batch`: it turns a single `size·8` story that batch refuses into
several `story·≤3`/`task` slices. Run `/split` to manufacture batchable work, then `/batch` to burn it down.
