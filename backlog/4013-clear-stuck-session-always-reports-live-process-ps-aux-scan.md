---
bornAs: x716z7e
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/operations/clear-stuck-session-io.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# clear-stuck-session always reports live-process: ps-aux scan self-matches the operation's own --session=<id> argv

scanPsForSession() in we:scripts/operations/clear-stuck-session-io.mjs bare-substring-matched the full session id against `ps aux` output, which always included the operation's OWN process (`node we:scripts/operations/run.mjs clear-stuck-session --session=<id>`) — so every session was reported confirmedStuck:false/live-process regardless of whether anything was actually running. Found live 2026-09-23 on 1a1a5ebe-e958-4ac7-ac05-581571181120, 3c32ec53-3a40-4bae-9a0b-6d8ac004f774, and 6 review-pa-180 sessions. Fix: anchor the match on the argv shape a REAL Claude Code session actually carries (--resume=<id>/--resume <id> or --session-id=<id>/--session-id <id>), which this operation's own --session=<id> flag never produces — excludes the operation's own process tree without needing its pid or ancestry. Kept the safe direction: an unreadable ps scan still yields null, never a false dead.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/clear-stuck-session.test.mjs` — the
   `scanPsForSession` case for the operation's own `--session=<id>` argv line (red on the pre-fix
   bare-substring match, green once the match is anchored on `--resume`/`--session-id`).

## Resolution

Fixed in `we:scripts/operations/clear-stuck-session-io.mjs#scanPsForSession`: replaced the bare
`out.includes(fullSessionId)` substring check with a pattern anchored on `--resume[= ]<id>` or
`--session-id[= ]<id>` — the argv shape a REAL Claude Code session carries, which this operation's own
`--session=<id>` input flag never produces. Verified against the real `ps aux`/`claude agents --json`
state on 2026-09-23: `3c32ec53-3a40-4bae-9a0b-6d8ac004f774` (job state `blocked`, no live process) now
reads `confirmedStuck:true` instead of the prior always-on `live-process` false positive; a genuinely
live background session (`64710aef-4d3c-4a60-8d06-2dbc2c469e15`, pid 41988) still correctly reads
`live-process`/not confirmed stuck. Both real runs were aborted (`--answer=abort`), moving nothing.
