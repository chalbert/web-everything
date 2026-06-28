---
kind: story
size: 8
parent: "1933"
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
tags: []
---

# Slice 3: orchestrator rewrite — lane-clone dispatch + central push/merge/rebase-retry

Replace the worktree-isolation orchestrator (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js) with the #1933 clone-based model. Per item: pick a lane from the pool (we:scripts/lane-pool.mjs, slice 2), dispatch the item agent into that lane clone, gate locally, commit explicit paths, push HEAD:lane/<slug>-<n> (#1934 carve-out). Central integrator (primary checkout): fetch lane/*, merge each into main one-at-a-time with a full check:standards per merge, rebase-and-retry on conflict (never force), delete the remote temp branch, regenerate derived artifacts (we:AGENTS.md, referenceIndex) once at the end. Claims are pre-assigned centrally — lanes never touch the central we:.claude/skills/batch-backlog-items/claims.json (#1933 choice 2). Reuses the #1869 ledger reconcile; multiLaneFiles detection runs against the assembled tree.

## Progress

- **Status:** resolved — clone-based orchestrator shipped; partition logic + syntax verified (15/15);
  `check:standards` green (0 errors).
- **Branch:** main (commit on current branch per never-branch policy).
- **Done:** rewrote `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` to the clone model
  (probe → partition → central pre-claim + `lane/_base` push → concurrent lane-clone dispatch + `lane/*`
  push → central merge/rebase-retry/serial-replay with full gate per merge + ref cleanup → derived regen
  once → #1869 reconcile vs HEAD). Updated `we:.claude/skills/batch-backlog-items/SKILL.md` (the execute-
  phase + non-negotiables 3/4 + the landing section: the integrator now lands on main, the main agent does
  no landing merge). Verified via a wrapped-sandbox syntax check + 8 partition-logic unit tests (scratchpad
  harness — the script can't run headless without the Workflow runtime + a live remote).
- **Live validation (downstream, by design):** the first real `/workflow` parallel run is the live proof
  (epic #1933 note; the closing-session skill audits each run). Not gateable here — the script needs the
  Workflow runtime + origin pushes + lane clones.
- **Leftover filed:** #1945 — the mandatory pre-lock reservation+lock layer (#1935 Fork 2 / #1936),
  blocked by #1938.
- **Design (grounded in the ratified decisions):**
  - **Central pre-claim + `lane/_base` (honours #1933 choice 2).** The orchestrator claims ALL items up
    front in the primary checkout (`we:scripts/backlog.mjs claim` flips status→active + writes the central
    claims file), commits that, and pushes the post-claim base to a throwaway `lane/_base-<slug>` ref.
    Concurrent lane clones `reset --hard` to that base, so each item is already `active` in the lane (lanes
    never run claim and never stage the claims file — the within-batch claims-file push-race choice 2
    rejects can't happen). This also makes every lane→main merge clean: merge-base = `lane/_base`, so an
    item's `active→resolved` flip is a one-sided change that 3-way-merges with no conflict.
  - **Concurrent items → lane clones** (one agent per item, `cd <lane>`): reset to base → work own files →
    lane fast-fail gate `npm run check:standards -- --local --files=…` (#1937 best-effort) → resolve →
    commit explicit paths (never the claims file/derived) → `push HEAD:lane/<NNN>-<n>`.
  - **Serial items** (monolith-touching / probe-uncertain) → worked sequentially in the primary checkout
    directly on `main` (already active from the pre-claim) — the old serial-lane semantics, on main.
  - **Central integration** (primary checkout = the tree the human watches, #1936 context; #1937 ruling:
    central full-gate is the authority): merge each `lane/<NNN>` into main one-at-a-time, **full
    `npm run check:standards` per merge**, **rebase-and-retry** on conflict (never force), serial-replay if
    a real semantic conflict survives, **delete the remote `lane/*` ref** after a clean land → derived regen
    once (`we:AGENTS.md` inventory block + `we:src/_data/referenceIndex.json` +
    `we:src/_data/capabilityWorkedExample.json`) → delete `lane/_base`.
  - **Safety-model shift (deliberate, decision-mandated).** The worktree model's "workflow never writes the
    live branch; main agent lands" is replaced by: all lane work is durably on `origin` (`lane/*` refs)
    before any merge, so a mid-integration failure loses nothing (refs persist; deleted only after a clean
    land). The central integrator therefore lands directly on the primary checkout's main — the main agent
    does NOT do a landing merge; it reports the ledger + surfaces multiLaneFiles/stranded.
  - Reuses the #1869 ledger-vs-tree reconcile (adapted: target = HEAD/main, not a throwaway branch).
- **Out of scope (follow-up slices):** the pre-lock reservation layer (#1945, blocked by #1938; ratified by
  #1935 Fork 2 / #1936 lock primitive) — slice 3 ships the optimistic git-merge FLOOR (Option D) with
  multiLaneFiles post-hoc detection, per this slice's body.
