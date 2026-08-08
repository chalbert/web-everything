---
kind: task
status: resolved
dateOpened: "2026-08-08"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
graduatedTo: "we:scripts/progress-board.mjs"
tags: [dx, reporting, artifact]
scope:
  - we:scripts/progress-board.mjs
  - we:scripts/__tests__/progress-board.test.mjs
  - we:reports/progress-board.json
  - we:skills-src/progress-board/SKILL.md
  - we:.claude/commands/board.md
---

# Progress board: a mechanically-refreshed published status page for the current plan

A generator + state file + skill that emit a published progress board from live PR state plus a small hand-maintained plan file, so one update costs **one Bash call and one Artifact call** and the model never touches HTML.

## Why

The operator's status currently lives in chat messages that scroll away. Keeping a published page current
means the model re-writing markup every time work moves — expensive per update, and error-prone in a way
that silently degrades the page (a dropped section, a stale timestamp, a hand-typed PR number).

The fix is to make the page a **derived artifact**: a script owns the markup, live PR state supplies most
of the content, and a tiny JSON file holds only the half a machine cannot know (the plan items and the
decisions waiting on a human). The model's whole job per update becomes one CLI verb.

## Shape

- **`we:scripts/progress-board.mjs`** — owns the page. Derives per-PR status live from
  `gh pr list` (needs-human / bounced / ci-red / conflicted / needs-review / queued / landed), reads the
  hand-maintained half from the state file, and emits a self-contained HTML fragment to a **fixed** path
  so the artifact URL stays stable. Degrades to a cached snapshot with a visible "stale" banner when `gh`
  is unavailable or rate-limited — a stale-but-rendered page beats a crash. Every mutation verb re-renders.
- **`we:reports/progress-board.json`** — the state: plan items (id, title, phase, status, note/blocker,
  optional linked PR), the decisions awaiting the operator, and **the artifact URL**.
- **`we:skills-src/progress-board/SKILL.md`** + **`we:.claude/commands/board.md`** — the usage contract:
  when to run it (on state change, not on a timer), the CLI verbs, the two-call cost contract, and the
  URL-stability rule.

## The URL-stability rule (the subtle part)

Republishing the same file path keeps the artifact URL **only within the conversation that first published
it**. From any other session the skill must pass the stored URL as the `url` parameter or a new URL is
minted and the operator's bookmark dies. That is why the URL lives in the state file, and why the skill
makes reading it a hard precondition of publishing.

## Done when

- The emitted page renders real current state (open PRs, plan items, decisions) with the operator's
  blocking items first.
- Every CLI verb re-renders and is idempotent.
- `gh` being unavailable degrades gracefully.
- Tests cover the derivation + the CLI, and `check:standards` is green.
