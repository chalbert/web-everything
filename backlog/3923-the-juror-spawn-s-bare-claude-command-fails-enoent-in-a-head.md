---
bornAs: xpjh8af
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/lib/__tests__/judge-spawn.test.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# the juror spawn's bare 'claude' command fails ENOENT in a headless review session's own environment

Live-caught 2026-09-23 investigating a review session stuck state:blocked: we:scripts/lib/judge-spawn.mjs's JUDGE_CLI constant was the bare string 'claude', PATH-resolved at spawn time by node:child_process's own spawn() -- but a headless review-dispatch session's own environment (running from the dedicated we:wev-review-daemon clone under launchd) did not carry the nvm-managed claude binary's directory on PATH, so every juror it tried to spawn from inside itself failed 'spawn claude ENOENT'. The review session ITSELF had started fine moments earlier (its own launch used an absolute path via we:scripts/operations/dispatch-lane-io.mjs); only the grandchild juror spawn, relying on a bare command name + PATH lookup from inside that session's own env, broke. This blocked every dispatched review system-wide, not only this one daemon's, and left the stuck session in state:blocked/status:idle forever (a headless session can never answer the interactive fallback a shell might otherwise offer). Fix: resolveJudgeCli() resolves the claude binary as a sibling of the currently-running node executable (process.execPath) -- nvm and most other Node version managers install claude alongside node in the same bin directory, confirmed live (which claude and process.execPath shared a directory) -- needing no PATH lookup at all. Falls back to the bare name (prior, unconditional behavior) when that sibling file does not exist, so a different install layout is still handled by whatever PATH the caller's own environment happens to have, exactly as before this fix. Verified by direct reproduction, not just unit-mocked: spawning the OLD bare 'claude' under a PATH stripped down to bare system dirs reproduces the exact live ENOENT; spawning the NEW resolved absolute path under the SAME stripped PATH succeeds and prints the real claude version.

## Progress

Fixed exactly as digested. Also fixed the two existing tests that hardcoded the literal string 'claude' (JUDGE_CLI's own "names the CLI once" test, and a judgeSpawn integration test asserting seen.cli === 'claude') -- both now assert against the real JUDGE_CLI constant / the environment-aware absolute-path shape, since the resolved value is no longer always the bare literal.

Confirmed by reintroduction: temporarily forced resolveJudgeCli to always return the bare literal early -- 3 of the 4 new tests correctly failed, restored to green.

Confirmed by DIRECT REPRODUCTION of the live incident, not just unit-mocked coverage: spawned the OLD bare 'claude' command under a PATH stripped to bare system dirs (/usr/bin:/bin:/usr/sbin:/sbin, matching the daemon's actual broken environment) -- reproduced the exact live ENOENT. Spawned the NEW resolveJudgeCli()-resolved absolute path under the SAME stripped PATH -- succeeded, printed the real claude version (2.1.280).

123/123 tests pass in we:scripts/lib/__tests__/judge-spawn.test.mjs.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/judge-spawn.test.mjs` passes (123/123): resolveJudgeCli resolves the sibling of process.execPath when it exists (both the real default and an injected fixture); falls back to the bare name when no sibling exists; the exists() check is asked about the sibling path, never process.execPath itself (confirmed by reintroduction to fail without the fix); JUDGE_CLI itself is either an absolute sibling path or the bare fallback, never something else; judgeSpawn's own default cli wiring is asserted against the real JUDGE_CLI constant, not a hardcoded literal.
2. **Executable, live reproduction (manual, not part of the automated suite)** — spawning the resolved binary under a PATH stripped to bare system dirs succeeds; spawning the bare literal 'claude' under the same stripped PATH fails ENOENT, confirming this is the exact live incident, not a hypothetical.
