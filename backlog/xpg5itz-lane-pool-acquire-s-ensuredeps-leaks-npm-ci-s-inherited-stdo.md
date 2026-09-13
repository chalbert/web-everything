---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-13"
tags: []
---

# lane-pool acquire's ensureDeps leaks npm ci's inherited stdout into the captured lane path

Found 2026-09-13 while fixing a real Codex fix-kind sandbox bug (commit a0d328fb1, lane/mechanical-dispatcher). we:scripts/lane-pool.mjs#ensureDeps (called from cmdAcquire's ensureDeps(dir) line, BEFORE cmdAcquire's own clean process.stdout.write(dir) at its end) runs npm ci / npm install via execFileSync with { stdio: 'inherit' } whenever a lane's deps are stale. Inherited stdio means npm's own install chatter writes to the SAME stdout fd as acquire's final clean path line — so a caller doing LANE=$(node we:scripts/lane-pool.mjs acquire ...) on a lane whose deps need installing captures npm's install output prepended to (or interleaved with) the lane path, corrupting every downstream consumer of that $LANE value. Observed live: a real dispatch attempt today hit ENAMETOOLONG because the captured 'path' was actually npm's install log plus the real path glued together. Fix direction (not done here): ensureDeps should not inherit stdio — capture/log npm's output separately (stderr, or a buffered pipe logged only on failure) so acquire's stdout stays exactly one line (the path), matching the 'stdout = path only' contract the file's own comments already declare.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
