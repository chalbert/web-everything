---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: scripts/check-backlog-item.mjs
tags: []
---

# Scoped per-item backlog lint (check:standards --item NNN) + optional PostToolUse hook on backlog/*.md

check:standards is a whole-repo scan, so the backlog-workflow rule can only ask for a gate run after a substantive body rewrite / before resolve — not per edit. A scoped per-item validator (check:standards --item NNN) running just the structural/rendering checks (link syntax, raw HTML, frontmatter, digest length, blocker-DAG) on one file would be cheap enough to run on every update, or to wire as a PostToolUse hook on backlog/*.md so it's automatic. Catches the render-on-/backlog/ footguns (a memory-style double-bracket link printing literally, raw interactive HTML swallowing the page) the moment they're written. Referenced from we:docs/agent/backlog-workflow.md as the long-term fix.

## Progress

**Resolved 2026-06-17 (batch-2026-06-17).**

- **Shared detector (no drift)** — extracted `lintBacklogItemRendering({ item, body })` into the unit-tested `we:scripts/check-standards-rules.mjs`: it composes the existing pure detectors (bad-body-links, raw-HTML, buried-fork, mis-flagged-batchable) with the **same canonical messages** the whole-repo gate emits. The gate (`we:check-standards.mjs`) now calls it — its four separate per-item passes (each re-reading the file) collapsed to **one** read + one call per item — so the scoped lint and the full gate can never diverge.
- **Scoped CLI** — `we:scripts/check-backlog-item.mjs`, wired as **`npm run check:item -- <NNN>`** (accepts `NNN` or `NNN-slug`, or `--item NNN`). Runs the shared rendering checks + the file-driven frontmatter unquoted-colon scan (file-driven because a malformed-YAML item is dropped by the loader, so it must be caught on the raw file) + per-item `blockedBy` resolution (every edge resolves to a real item, no self-ref). Exits 1 on any error, 0 with warnings — so it can block a bad edit. Falls back to a raw gray-matter parse when the loader skipped the item (precisely the colon-typo case).
- **Hook recipe** — documented an opt-in `PostToolUse` hook on `backlog/*.md` in `we:docs/agent/backlog-workflow.md` (the long-term-fix reference is now the shipped command, not "tracked separately"). Left opt-in rather than force-installed — it mutates the user's harness settings.
- **Scope split** — the scoped lint owns the cheap per-file rendering/structural checks; the whole-repo `check:standards` stays the authority for cross-entity checks it can't see (graduatedTo/relatedProject resolution, the `blockedBy` **cycle** walk, dup ids, decision/epic conflation). Digest-length stays in `validateBacklogItem` (the registry-coupled validator); the scoped CLI re-checks it inline.
- **Tests** — added a `lintBacklogItemRendering` describe block (4 cases: wiki-link/dead-md errors + raw-HTML warn; fork-heading gated to non-decision/non-resolved; non-batchable marker gated to `batchable`; clean body). Full suite green (123 rules tests, 22 gate tests); `check:standards` regression-checked — identical findings, 0 errors.

`graduatedTo` → `we:scripts/check-backlog-item.mjs` (the scoped validator).
