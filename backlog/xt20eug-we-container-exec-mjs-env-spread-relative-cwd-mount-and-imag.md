---
kind: story
size: 3
parent: "3621"
status: open
scope: ["we:scripts/lib/container-exec.mjs", "we:scripts/lib/__tests__/container-exec.test.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# we:container-exec.mjs: env spread, relative-cwd mount, and image-match correctness bugs (PR #2206 review)

Independent jury review of PR #2206 (heavy-command-pool container POC) marked 3 real correctness findings OWED (owed = should become a tracked item, not just a review comment). All three are confirmed, non-blocking-but-real bugs in we:scripts/lib/container-exec.mjs: (1) execContainerized (around line 172-190) spreads the whole caller opts bag, including opts.env, into the real execFileSync options object for the host-side container-launching process, contradicting the function's own JSDoc/comment claiming opts.env is not passed into the container -- a caller supplying env alongside execFile/readAlternates (exactly what the existing 'exec seam' unit test exercises) gets that minimal env object forwarded as the literal env for the container-launching execFileSync call, stripping PATH and every other host var; fix is to destructure only the intended pass-through spawn keys (e.g. stdio) rather than spreading the full opts object, plus a unit-test assertion that the built execFile call options exclude env/execFile/readAlternates. (2) execContainerized passes the raw opts.cwd straight into the --volume mount argv without resolving it to an absolute path first (we:scripts/lib/container-exec.mjs:154), so a caller-supplied relative --repo/cwd (e.g. we:scripts/readiness/heavy-admission.mjs run --container --repo ./lane-1) builds a relative --volume flag that the container CLI hard-fails on, since it requires absolute host paths; fix is to resolve cwd to an absolute path (path.resolve) before building the volume argv, plus a unit test asserting a relative opts.cwd yields an absolute --volume path in the built argv. (3) containerImageAvailable (we:scripts/lib/container-exec.mjs, the single function spanning roughly lines 183-189) does prefix/substring matching instead of an exact image:tag match -- line.trim().startsWith(image.split(':')[0]) && line.includes(image.split(':')[1] || 'latest') -- so a similarly-named image (e.g. we-heavy-admission-old:poc or we-heavy-admission:poc-old) wrongly passes the availability check for we-heavy-admission:poc, leading to a runtime container-run failure instead of the promised clear build-guidance message; this single bug was independently caught by two jurors (codex-correctness at the startsWith call, antigravity-review at the same containerImageAvailable body) confirming it is the same call site, not two distinct bugs; fix is to parse and compare image identity exactly (name + tag) rather than startsWith/includes, plus deterministic unit cases rejecting name-prefix and tag-substring near-matches. All three landed with PR #2206 still OPEN (review:accepted, ready-to-merge, not yet drained onto main as of this filing) -- verify current line numbers against we:scripts/lib/container-exec.mjs on main once #2206 lands, they may shift slightly.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
