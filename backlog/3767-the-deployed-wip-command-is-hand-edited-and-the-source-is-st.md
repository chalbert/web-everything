---
bornAs: x9mic7n
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:.claude/commands/wip.md", "we:scripts/bootstrap-session.mjs", "we:scripts/sync-commands-deploy.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# The deployed /wip command is hand-edited and the source is stale: track it in source, deploy it from the bootstrap, and detect drift

The operator's `/wip` command is deployed by hand and the source does not describe it. Found 2026-09-20.

FOUND, AND WHERE. (1) The source copy, we:.claude/commands/wip.md (93 lines, on main), is the OLD command: a per-session table of Done, Doing, Next built from conversation history and ListAgents. (2) The deployed `wip` command file in the operator's home commands directory (11 lines, modified 2026-09-20 12:11) has been replaced by hand: a prompt that runs one foreground command, which fetches lane/mechanical-dispatcher into the personal clone named wev-wip-report under the workspace directory, and runs we:scripts/operations/wip-report-cli.mjs with `--stamp`, then prints the output verbatim. So the premise "the deployed command was not updated" is half wrong: it was updated in place, and it is the SOURCE that is stale. It contains no remedy vocabulary at all, so the wip-honest owed item "add the new remedy values to the command text" (`auto (runner down)`, `run: session-reaper`, `start: /conveyor`) does not apply to it; the vocabulary lives in the report code. (3) we:scripts/sync-commands-deploy.mjs with `--check` (read only) reports `DRIFT commands: ~1` and `STALE commands: 2 file(s) at the deploy target are not tracked in source — the two files named continue and handoff`, matching the bootstrap report. (4) THE RISK: the bootstrap's `commands` step (we:scripts/bootstrap-session.mjs line 239) runs we:scripts/sync-commands-deploy.mjs with `--all`, whose `update` action copies the source file over the deployed one (`copyFileSync` in we:scripts/sync-skills-deploy.mjs `applyPlan`). The next `npm run bootstrap install` would therefore overwrite the operator's working `/wip` with the 93-line old version. Not run to confirm; read from the code. (5) The report CLI we:scripts/operations/wip-report-cli.mjs is on lane/mechanical-dispatcher only, not on main, and the deployed command hard-codes the path of a personal clone plus a node_modules symlink into another lane (`lane-54`). (6) The command files named continue and handoff are deployed but not tracked in source; they are the two "stale" files. Untracked deployed files are only ever reported; deleting them needs `--prune`.

DESIGN TO SETTLE.
1. Source of truth: make we:.claude/commands/wip.md the report runner, tracked and deployed by the bootstrap, so the deployed file equals the source. The old session-table wording needs a new home or is dropped: it overlaps `/status` (we:.claude/commands/status.md), so recommendation is to drop it; the operator decides.
2. The command must not hard-code a personal clone. Options: run the CLI from the checkout the session is in (fails while the CLI is branch-only), or wait for the CLI to graduate to main (#3443) and then run it from any current checkout. Decide the interim.
3. Track the continue and handoff commands in source, or delete them from the deploy target with `--prune`, so the bootstrap reports no stale commands.
4. Drift detection: `--check` already exits 1 on drift. Decide whether the bootstrap's report also fails loudly (today it says `drift` and carries on), and whether a hand edit of a deployed command gets a warning before the next deploy overwrites it.

## Done when

1. **Executable** — `we:scripts/sync-commands-deploy.mjs` run with `--check` prints no `DRIFT` line and no `STALE` line. Before (2026-09-20): `DRIFT commands: ~1` and `STALE commands: 2 file(s) ... not tracked in source`.
2. **Executable** — the deployed `wip` command file equals `we:.claude/commands/wip.md` byte for byte (`cmp` exits 0).
3. **Executable** — `npm run bootstrap:check` reports the `commands` line as ok, with no stale-commands line. (Not run in this filing; the exact line comes from the bootstrap's own output.)
4. **Executable** — a test with a scratch deploy directory (the `WE_COMMANDS_DEPLOY_DIR` override in `we:scripts/sync-commands-deploy.mjs`) shows that a hand-edited deployed command is reported as drift, and, if the design chooses a warning, that the warning comes before the deploy overwrites it.
5. **Human verify** — typing `/wip` in a session prints the report, from a checkout that is not the personal clone the hand-edited command uses today.
