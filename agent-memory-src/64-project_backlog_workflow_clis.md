---
name: project_backlog_workflow_clis
description: "Two deterministic CLIs back the next/batch skills — check-readiness --select for ranking, backlog.mjs for status mutation; consume them, don't re-derive"
metadata: 
  node_type: memory
  type: project
  originSessionId: 496eddc1-fad4-403f-92c6-e66f505404b6
---

The backlog selection + status-mutation rubric is now **scriptified** so the `next-backlog-item` /
`batch-backlog-items` skills consume deterministic output instead of re-globbing `backlog/*.md` and
re-running the rubric in prose (the bug that fixed this: `/batch` hand-derived 2 batchable items in
minutes where the loader lists ~23 instantly).

- **`node scripts/check-readiness.mjs --select`** (also `--json` → `selection.{counts,tierA,batchable,tierB}`):
  the deterministic ranked view — a pure projection of loader-derived `tier`/`batchable`/`leverageScore`
  ([[feedback_authoring_standard_workflow]]). Same data as the `/backlog/` Prioritisation tab, same
  loader (`src/_data/backlog.js`) → **zero desync**. This is step 1 of selection; the only per-item LLM
  judgment left is the body-fork pre-flight, **on the shortlist only**. `computeSelection` lives in
  `scripts/readiness/engine.mjs`.
- **`node scripts/backlog.mjs <verb>`** — mechanical status mutation, one surgical frontmatter splice
  each (body never touched): `claim <NNN>` (race-safe `open→active` + `dateStarted`, prints rename slug),
  `resolve <NNN> [--graduated-to=X|none]` (`active→resolved` + `dateResolved`), `release <NNN>`
  (`active→open`), `scaffold --type= --workitem= --size= --title= [--digest=] [--blocked-by=]` (atomic
  next-`NNN` allocation + check:standards-shaped item; `--digest` authors it in one shot), and the
  **cross-session reservation** pair (#083, built 2026-06-12) `reserve <NNN...> --session=<slug>` /
  `unreserve [--session=] [<NNN...>]` — a batch soft-holds its planned pack so another concurrent batch's
  `--select --session=<slug>` **deprioritizes** (never excludes) those items. Advisory only (the real lock
  is still `claim`, which auto-drops a hold); TTL-expiring (default 120m), self-pruning, registry at
  `.claude/skills/batch-backlog-items/reservations.json`. The penalty applies at the `check-readiness.mjs`
  CLI boundary (time/session-dependent), NEVER inside the byte-deterministic `computeSelection`. Pure core in
  `scripts/backlog/{frontmatter,scaffold}.mjs` + `scripts/readiness/reservations.mjs`, CLIs allowlisted in checked-in `.claude/settings.json`,
  tested. The CLI does the **edit only** — `resolve` assumes you already ran the close-out gate; `claim`
  still leaves the chat-rename to you (prints the slug). A node CLI may use `new Date()` for "today"
  (only Workflow scripts can't).

**Untracked-file claim caveat (this branch).** `claim` has a concurrency guard that `die()`s when
`git status --short` shows the file dirty — and that includes **untracked (`??`)** files, not just
modified ones. On a branch whose backlog scaffolds were never committed, **every** item is untracked, so
`claim` refuses on all of them (`"… has uncommitted edits — another session may be on it"`). When you've
verified it's your own uncommitted branch state (not a concurrent agent), **hand-claim**: set
`status: active` + add `dateStarted: "<today>"` right after `dateOpened` (exactly what `applyTransition`
writes). This is the one sanctioned exception to "never hand-edit status." Only `claim` has the guard —
`resolve` / `scaffold` / `release` work normally via the CLI, so the rest of the arc stays mechanical.
(The user batches without committing per-story, so this recurs until the branch is committed.)

**Why:** mechanical work (tier/batchable derivation, status flips, id allocation) was burning agent time
+ context on every item, and drifting from the deterministic source. **How to apply:** in backlog work,
reach for these verbs first; never reconstruct the batchable set or hand-edit `status`/dates (except the
untracked-file claim caveat above). The rubric
itself still lives in `docs/agent/backlog-workflow.md` — keep the CLIs and that doc identical if either
changes. Related: [[feedback_backlog_is_tracker]], [[feedback_backlog_closeout_resolve_not_delete]],
[[feedback_backlog_nnn_immutable]], [[feedback_batch_conflict_avoidance]].
