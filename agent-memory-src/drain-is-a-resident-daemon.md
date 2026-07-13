---
name: drain-is-a-resident-daemon
description: "The drain runs as a resident launchd daemon (installed 2026-07-13) — do NOT manually /drain; it auto-lands ready-to-merge PRs every 60s. Recall before running /drain or wondering why a PR merged with no human."
metadata:
  type: project
---

On 2026-07-13 the phase-1 resident drain daemon (#2449, `plateau-app/tools/drain-daemon/`)
was installed as a launchd LaunchAgent (`com.plateau.drain-daemon`, RunAtLoad + KeepAlive)
and started. It holds the whole-process drain lease and runs `merge-ai-prs.mjs` as one-shot
passes every 60s from a dedicated WE clone (pool `we-drain-daemon`). So the drain now runs
**continuously and unattended** — this is the "AI runs longer by itself" switch, and the
operating evidence it produces is what unblocks the deferred agent-runner decision (#2444).

**Why:** the drain used to be run by hand (`merge-ai-prs --only=NNN`) or by an interactive
`/drain` session. A resident owner replaces that — it is the sole full-sweep drain owner
while resident.

**How to apply:** do NOT manually `/drain` or run a full `merge-ai-prs` sweep while the
daemon is resident — you'll no-op on its lease (or fight it). A `ready-to-merge` PR just
lands within ~60s on its own. Scoped `--only=<pr>` fast drains (via `/pr`) still bypass the
lease and are fine. This is machine-local operational state that can change (the operator
can `cli.mjs uninstall`), so VERIFY before relying on it: `node
plateau-app/tools/drain-daemon/cli.mjs status`. Related: [[backlog-is-the-tracker]].
