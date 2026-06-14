---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["466"]
dateOpened: "2026-06-13"
tags: [stop-the-world]
---

# Migrate backlog schema to single kind axis (per #466 ruling)

Execute the #466 ruling: collapse type + workItem into one fresh kind field (story|epic|task|decision), dropping both old fields. One-pass rewrite of every backlog/*.md frontmatter, plus the tooling that reads them — loader tiering (backlog.js:243-256), validator enum/sizing/fork-lint (check-standards-rules.mjs:21,120,139-148,219-237), scaffold flags + emit (scripts/backlog/scaffold.mjs:42-44, scripts/backlog.mjs:155-177), render badges + typeOrder (backlog.njk, backlog-pages.njk), and the normative enum + agile-sizing table in docs/agent/backlog-workflow.md. fix-vs-feature becomes an optional tag, not a field. Gate: check:standards green after the rewrite.

## Run precondition — execute on a quiescent backlog (stop-the-world)

This is a stop-the-world refactor: it bulk-rewrites the frontmatter of **every** `backlog/*.md`.
Because all sessions share one working tree, the real hazard isn't schema drift across clones — it's a
**filesystem-level collision**: the bulk rewrite racing a concurrent `claim`/`resolve` status-splice on
the same file. So before claiming this item, **confirm the backlog is quiescent**:

- **No other `status: active` claims** held by another session (scan `backlog/*.md`), and
- **No live batch reservations** (`.claude/skills/batch-backlog-items/reservations.json` empty/expired).

If a batch is mid-run, wait for it to drain (or coordinate a stop) — don't run this alongside it. A
global freeze can't be *enforced* (reservations are advisory, #083), so the migration also defends
itself:

- **Idempotent, re-runnable converter** — convert any file still carrying `type`/`workItem`, skip
  already-migrated ones. A straggler created mid-window is swept by a re-run, never corrupted.
- **Validator is the backstop (the #466 Fork-2 "loud break" payoff)** — after the cutover,
  `check:standards` must **error** on any leftover `type:`/`workItem:`. Any item a parallel session
  births with the old schema then fails the gate loudly instead of silently drifting.
- **Single atomic commit** for data + tooling together — no window where the new `scaffold.mjs` emits
  the old schema, or vice-versa.
