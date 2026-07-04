---
kind: story
size: 3
status: resolved
relatedTo: ["2183", "2123", "2190"]
dateOpened: "2026-07-03"
dateStarted: "2026-07-04"
dateResolved: "2026-07-04"
tags: [pr-flow, close-out, closing-session, memory, tech-debt]
---

# Route close-out commits (closing-session auto-commit + memory writes) through the #2183 lane→PR model

Post-#2183/#2190, **all edit work already lands via a lane→PR during the session**, so the
`we:.claude/skills/closing-session` auto-commit-to-`main` step is now a **residual direct-to-main path** that
contradicts the ratified PR-only model. Surfaced at the 2026-07-03 close of the #2183 rollout: the close
audit wanted to auto-commit this session's own work (2 agent-memory files) straight to `main`, which #2183
forbids.

## Scope

- **closing-session auto-commit** — should **no-op on already-PR'd work** (the common case now: nothing
  edit-shaped is left uncommitted at close), and for anything genuinely uncommitted-and-finished, route it
  through the lane→PR helper instead of `git commit` on `main`.
- **agent-memory / session-meta writes** — memory is written directly to `we:.claude/agent-memory/` on disk
  (captured for the local checkout) but persisting it to `origin` currently means a direct main commit.
  Decide the landing path: either (a) a lane→PR for memory too, or (b) an explicit **sanctioned-direct
  carve-out** for session-meta (memory + `we:claims.json`-class local signals), documented against the #2183
  rider — since these are *not* "edit-action" work and #2183's rider already treats `we:claims.json` as a
  direct local signal. Likely (b), scoped tightly.
- Sweep for **any other close-out / skill that still commits to `main`** (e.g. batch close, calibrate) and
  reconcile with the #2183 rider.

## Acceptance

- No close-out path direct-commits edit work to `main`; each is either a lane→PR or a documented
  session-meta carve-out under `we:docs/agent/platform-decisions.md#pr-flow-rollout-mechanism`.
