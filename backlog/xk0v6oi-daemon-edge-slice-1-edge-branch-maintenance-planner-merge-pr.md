---
kind: story
size: 5
parent: "x59tqsg"
status: resolved
scaffoldedBy: "daemon-edge-slice1"
dateScaffolded: "2026-09-27"
scope: ["we:scripts/lib/daemon-edge.mjs", "we:scripts/daemon-edge.mjs", "we:scripts/daemon-overlay.mjs", "we:scripts/lib/__tests__/daemon-edge.test.mjs"]
dateOpened: "2026-09-27"
dateResolved: "2026-09-27"
tags: []
---

# daemon-edge slice 1: edge branch maintenance planner (merge PR, merge main, record clash as owed, revert on close) behind a default-off flag

Pure planner over an injected git runner plus an IO shell (we:scripts/lib/daemon-edge.mjs, CLI we:scripts/daemon-edge.mjs) that keeps daemon-edge: merges each registered PR in once, merges main in, records a clash as an owed resolution without dropping, reverts a PR closed unmerged, retires a landed one. Flag WE_DAEMON_EDGE default off; overlay behavior untouched.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/daemon-edge.test.mjs` passes (fails before: the module
   does not exist). It covers, on real temp git repos: bootstrap at main; a PR merged in once and not re-merged;
   main merged in every tick; a moved head re-merged; two clashing fixes — the second recorded as owed (same id
   across ticks, never dropped), and after a resolver push both stay in edge through a later main move; a PR
   closed unmerged reverted out (the other stays); closed-before-edge retired; landed-on-main retired; a main
   clash owed while PR merges proceed; soft-cap warning; admission refuses a main clash unless forced.
2. **Flag off is inert** — with `WE_DAEMON_EDGE` unset, a real tick/register returns `flag-off`, writes no ledger,
   pushes nothing; `daemon-overlay add` output and state are unchanged (tested).

## Scope notes

- Not wired into the daemon tick. The CLI is `node we:scripts/daemon-edge.mjs register|tick|status [--dry-run]`.
- State lives under `~/.claude/daemon-edge/` (`WE_DAEMON_EDGE_DIR` overrides): a ledger file, an events log,
  and a scratch bare repo the tick fetches into and pushes from. Never a daemon clone.
- The real `daemon-edge` branch is not created by this slice.
