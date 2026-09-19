---
kind: story
size: 1
parent: "3621"
status: open
scope: ["we:scripts/lib/container-exec.mjs", "we:scripts/lib/__tests__/container-exec.test.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# we:container-exec.mjs: env spread, relative-cwd mount, and image-match correctness bugs (PR #2206 review)

Independent jury review of PR #2206 (heavy-command-pool container POC, merged 2026-09-14) marked 3 correctness findings OWED (owed = should become a tracked item, not just a review comment) in we:scripts/lib/container-exec.mjs. Re-checked against current main: only ONE is still live. The other two were fixed on main by ad471675e ("fix: resolve container mount cwd and exact-match container image lookup"), with regression tests, so do not re-investigate them:

- ALREADY FIXED (relative-cwd mount): execContainerized now does `resolve(opts.cwd || process.cwd())` and buildContainerRunArgs resolves cwd before building the `--volume` argv.
- ALREADY FIXED (image-match): containerImageAvailable now compares the NAME and TAG columns of `container image list` exactly, so `we-heavy-admission-old:poc` and `we-heavy-admission:poc-old` no longer pass for `we-heavy-admission:poc`.

STILL OPEN: execContainerized (the final `execFile('container', args, { stdio: 'inherit', ...opts, cwd: undefined })` call, around line 271) spreads the whole caller opts bag, including opts.env, into the options of the real execFileSync call for the host-side container-launching process. That contradicts the function's own comment claiming env is not passed into the container: a caller supplying env alongside execFile/readAlternates (exactly what the existing 'exec seam' unit test exercises) gets that env object forwarded as the literal env of the `container` launcher process, stripping PATH and every other host variable. Fix: destructure only the intended pass-through spawn keys (e.g. stdio) instead of spreading opts, plus a unit-test assertion that the options handed to the built execFile call exclude env, execFile and readAlternates.

## Done when

1. **Executable** — running vitest on we:scripts/lib/__tests__/container-exec.test.mjs includes a test asserting that the options passed to `execFile('container', ...)` contain no `env`, `execFile` or `readAlternates` key when the caller supplied them; it fails before the fix and passes after.
