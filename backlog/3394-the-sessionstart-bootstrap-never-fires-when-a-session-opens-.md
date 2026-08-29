---
bornAs: xbf251u
kind: story
size: 3
parent: "3182"
status: open
dateOpened: "2026-08-29"
relatedTo: ["3272", "3183", "3246"]
scope:
  - we:.claude/settings.json
  - we:scripts/bootstrap-session.mjs
  - we:scripts/__tests__/bootstrap-session.test.mjs
  - we:docs/agent/vm-sessions.md
tags: [bootstrap, cloud-vm, delivery, portability]
---

# The SessionStart bootstrap never fires when a session opens beside the checkout instead of inside it

Observed 2026-08-29 on a cloud session: the container's working directory was the PARENT of the checkout, not
the checkout. The project `SessionStart` hook lives in the repo, so it was never loaded, and its command is a
RELATIVE one — `node` plus a repo-relative path to `we:scripts/bootstrap-session.mjs` — which resolves to
nothing from one level up. Neither failure is reported: a hook that never loads emits nothing, so the session
ran unconfigured and looked identical to a configured one. Everything #3182 makes travel is inert whenever
the trigger misses.

## Why the existing answers do not cover it

- **The user-level registration (#3074, `installHook`)** writes an ABSOLUTE path and is immune to cwd. But it
  is installed by `npm run bootstrap install` — which is the very thing that did not run. On a fresh container
  nothing has installed it yet, so the durable fix is unreachable on exactly the host that needs it.
- **#3199** fixes locus detection once the script RUNS. This item is about it not running at all.
- **#3183 / #3272** are downstream consequences of an unconfigured VM, not the trigger.

## Build

- **Make the project hook cwd-independent** (`we:.claude/settings.json`) — the harness exports a
  project-directory variable (`CLAUDE_PROJECT_DIR`) for exactly this, so the hook command interpolates it
  instead of leaning on the working directory. That name appears nowhere in the tree today. This alone fixes
  a session opened in a SUBdirectory; it does not fix one opened ABOVE the checkout, where the project
  settings are never read at all.
- **Cover the opened-beside case at container setup** — the box's own setup step runs the bootstrap once, so
  the trigger does not depend on where a later session happens to stand. This is the half that actually closes
  the observed failure; `we:docs/agent/vm-sessions.md` gains the one line saying so.
- **Make a missed trigger VISIBLE rather than silent** — the honest residual is that no hook can report its
  own non-firing. The cheap proxy: `we:scripts/bootstrap-session.mjs` already knows whether it is on an
  ephemeral host, so a command that runs later on such a host can ask whether the bootstrap left its mark, and
  say so when it did not. A silent miss is what made this cost a whole session.

## Residual, stated

The project-directory variable is harness-provided. If a future harness stops exporting it, the hook breaks in
the other direction — loudly, as a command that fails — rather than silently, which is the better failure.

## Done when

1. **Executable** — `grep -c "CLAUDE_PROJECT_DIR" we:.claude/settings.json` returns at least `1`, where today
   it returns `0`.
2. **Executable** — a test in `we:scripts/__tests__/bootstrap-session.test.mjs` pins that the committed
   project hook command resolves through that variable and carries no bare repo-relative path, so the
   regression cannot return unnoticed.
3. A cloud session opened in the parent of the checkout reports that the bootstrap ran — or says plainly that
   it did not.
