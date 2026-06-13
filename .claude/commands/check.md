---
description: Run the repo health gate (check:standards) only — no session-context / close audit. Safe mid-session or in a fresh session.
---

Run the project's **repo health gate only** and report pass/fail. This is deliberately **just the
invariant verification** — NOT the `closing-session` audit: do **no** context-capture, backlog,
active-story, blocker-DAG, git, or working-state review. It reads the working tree live, so it is safe
to run mid-session or in a brand-new session and gives the same verdict either way.

Steps:

1. `npm run gen:inventory` — refresh the derived `AGENTS.md` inventory first (idempotent; rewrites
   `AGENTS.md` **only** when the inventory actually changed). This avoids a false-red
   "AGENTS.md inventory is stale" failure. It is a derived-file refresh, not content capture.
2. `npm run check:standards` — the invariant gate. Report the result faithfully: the final
   `N error(s), M warning(s)` summary line, and **list every `error` line in full** (errors block the
   gate; warnings are FYI, summarise the count).
3. **Only if `$ARGUMENTS` contains `full` or `tests`:** also run `npm run verify` (vitest run + 11ty
   build smoke) and report its pass/fail. Otherwise skip it — the default is the fast standards gate.

Report format: a one-line verdict — ✅ **green** (0 errors) or 🔴 **red** (≥1 error) — then the error
lines verbatim (if any) and the warning count. Stop there.

Notes:
- This is a **whole-repo** gate. An error about an orphaned report or another backlog item may belong to
  a **concurrent session**, not the caller's work — report it faithfully but say so; don't try to fix
  unrelated items.
- Do not turn this into a commit prompt or a session-close. For the full close safety-check (context
  capture + working state), use `/close` instead.

$ARGUMENTS
