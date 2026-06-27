---
kind: story
size: 8
status: active
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
tags: [backlog-ui, dx]
locus: webeverything
---

# Active-work tab with live workflow/batch progress fed from the harness journal

A Backlog **Active-work** tab that surfaces in-flight Claude sessions, batches, and workflows with live progress and clear batch/workflow membership, fed by a dev-only watcher that digests the harness's own on-disk run journal + subagent transcripts into a polled `we:active-progress.json` — the read-side mirror of the existing `we:reservations.json` soft-hold.

## Why

Two blind spots, the second is the one that actually bites:

- **Active cards aren't gathered.** Items go `status: active` when claimed, and the Prioritisation tab pins "deciding now" / "batching now" rows, but there's no one place that answers *"what is being worked right now, and how far along?"*
- **Workflow progress is invisible in this editor.** A `/workflow` run fans out subagents in the background; its live progress lives in the `/workflows` TUI, which the VS Code extension does not have. So a multi-agent run is a black box until it returns — exactly when you most want to follow it.

## Key finding — the data already exists on disk

The premise "have the workflow save its progress to a temp file" can't work as stated: a Workflow **script** runs sandboxed with no filesystem access. But it doesn't need to — the **harness already persists live progress**, per session, as it runs:

- **Run journal** — `workflows/wf_*.json` under the session dir in `~/.claude/projects/<project>/<session>/`. Holds the script, `meta.name`, `phases[]`, and each `agent()` completion. Written incrementally (it's what `resumeFromRunId` replays), so it's a clean **phase/agent status board** at agent-completion granularity.
- **Per-subagent transcripts** — `subagents/agent-*.jsonl`, appended continuously as each subagent works (assistant/tool/user events). The fine-grained "what is agent N doing *right now*" stream.

So the mechanism is the inverse of "workflow writes a file": the **website reads the files the harness is already writing** — the same shape as the backlog already reading `we:reservations.json` (`we:src/_data/backlog.js` → `items.activeBatches`).

## Batch / workflow membership (coordination view)

The point isn't just per-item progress — it's *which work belongs to which run*, so concurrent batches/workflows can be coordinated rather than colliding. Group active items under their owner:

- **Batches** — `we:reservations.json` already groups by `session` (`batch-YYYY-MM-DD-n1-n2…` slug → its item nums + points). The active-batches strip on Prioritisation already renders this; the new tab promotes it to a first-class grouped board.
- **Workflows** — the journal's `runId` + `meta.name` name the run; the `agent()` labels/args carry the per-lane backlog num (a `/workflow` batch's lanes *are* backlog items). Group the run's lanes under one workflow header showing phase + per-agent status.
- **Ad-hoc sessions** — a plain claimed item with no batch/workflow owner shows standalone.

Result: at a glance, "run X owns #a #b #c, currently in phase Verify, agent #b failed" — the coordination signal that's missing today.

## The only new code — a dev-only watcher

A small watcher (run alongside the dev server) digests the journal (+ optionally tails the jsonls for last-activity) into one `we:active-progress.json`:

```
{ runs: [ { kind: 'workflow'|'batch'|'session', id, name, phase,
            items: [ { num, label, status, lastLine, updatedAt } ] } ],
  updatedAt }
```

The Active-work tab (`we:src/backlog.njk`, a new panel beside the existing tabs) renders the grouped board and **polls `we:active-progress.json` every few seconds** for true live updates with no rebuild. Mapping the journal/jsonl (keyed by session, not backlog num) back to item nums is the one bit of real logic — read it from the `/workflow` lane labels / the batch reservation slug.

## Honest scope / caveats

- **Dev-only, frozen on static publish** — like the active-batches strip. Correct: these are session internals you would not want on a public build anyway.
- **Membership precision** — clean for `/workflow` and `/batch` (lanes/slug carry nums); a fully ad-hoc workflow with no per-num labels shows as a generic "workflow in flight," not pinned to cards.
- **Granularity tradeoff** — the journal gives a tidy per-agent/phase board for free; tailing the jsonls adds live "current activity" but is verbose and needs a digest (last assistant text / current tool).

## Suggested slices (if this wants splitting)

1. Static **Active-work tab** — gather `status: active` items, grouped by batch (reuse `items.activeBatches`) + standalone. No new data source; refreshes on rebuild. (quick win)
2. **Watcher → `we:active-progress.json`** digesting the journal into the grouped-runs shape, + **client polling** on the tab for live updates.
3. (optional) **jsonl tail** for fine-grained per-agent current-activity.

## v2 — command-center redesign (reopened)

A first cut shipped (tab + workflow live board + watcher) but a design review found it doesn't serve the real persona — *managing many concurrent operations at once*. Gaps: no lane for **preparing**; **decision / slicing** not distinguished from other active work; batch grouping invisible when no live reservation; and **live progress existed only for workflows** (journal-backed), not for prepare / decide / slice / batch sessions. Reopened and rescoped (size 5 → 8):

- **Operation-type lanes** — the panel groups active work into **Preparing · Deciding · Slicing · Batching · Building · Workflows**, derived in the loader from `status` (`active`/`preparing`) + `kind` + reservation membership. Each lane is a labelled section; a top **vitals bar** rolls up counts + live totals.
- **Per-session live digest** — the watcher maps every active item to the session working it (scan each session transcript for its `we:scripts/backlog.mjs claim <num>` minus a later `resolve`/`release`; sessions live under the harness projects dir), and tails that transcript for a digest: **current in-progress todo + last action/tool + last assistant line + updatedAt**. This is the live "chat progress" for non-workflow work — confirmed extractable. Polled into `we:active-progress.json` as a `num → digest` map and overlaid on each lane row client-side.
- **Coordination** — each unit shows the cards it touches; runs/sessions sharing or cross-gating items are surfaced so concurrent work coordinates instead of colliding.
- **Polish** — panel sits on a neutral surface (not the page gradient); compact rows that scale to many-at-once; chip de-duplication; batches always visible.
