---
bornAs: xuyjss1
kind: task
status: resolved
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/lane-pool.mjs", "we:scripts/lib/git-patch-equivalence.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "755a028a365b4e3a32068358009c09c97d84f7a1"
tags: []
---

# Extract the shared we:git-cherry patch-equivalence primitive between we:scripts/conveyor/lease-reaper.mjs and we:scripts/lane-pool.mjs

we:scripts/conveyor/lease-reaper.mjs's defaultGitIsAncestor (added by #4311) and we:scripts/lane-pool.mjs's cherryAllPatchEquivalent independently implement the same small git-cherry-output parse ('every line prefixed - means already patch-equivalent') for two different callers (branch-vs-one-merge-commit containment in the former, a lane's ahead commits vs a live remote head in the latter). we:scripts/conveyor/lease-reaper.mjs cannot import we:scripts/lane-pool.mjs (that file already imports FROM we:scripts/conveyor/lease-reaper.mjs, so the reverse would cycle), so today this is a small, deliberately-accepted duplication rather than a shared primitive. Extract the single-target git-cherry patch-equivalence check into a small shared module (e.g. we:scripts/lib/git-patch-equivalence.mjs) both files import, and reduce each call site to a thin wrapper — no behavior change, single-sourcing only.

## Done when

1. **Executable** — the command below fails (module does not exist) before this item lands and passes after:
   ```
   npx vitest run scripts/lib/__tests__/git-patch-equivalence.test.mjs
   ```
2. `we:scripts/conveyor/lease-reaper.mjs`'s `defaultGitIsAncestor` and `we:scripts/lane-pool.mjs`'s
   `cherryAllPatchEquivalent` each import the shared parse from `we:scripts/lib/git-patch-equivalence.mjs`
   instead of inlining their own copy of the `lines.length === 0 || lines.every(l => l.startsWith('-'))` check.
3. No behavior change: the existing real-git regression suites that already cover both call sites
   (`we:scripts/conveyor/__tests__/lease-reaper.test.mjs`'s `#4337 — defaultGitIsAncestor …` describes, and
   `we:scripts/__tests__/lane-pool-acquire-explicit-lane-patch-equivalent.test.mjs` /
   `we:scripts/__tests__/lane-pool-squash-merge-and-litter-acquirable.test.mjs`) still pass unmodified.

## Design

Both call sites already run their OWN `git cherry <upstream> <head>` spawn, with genuinely different
surrounding contracts: `we:scripts/conveyor/lease-reaper.mjs`'s `defaultGitIsAncestor` distinguishes a
definitive `false` from an unresolvable `null`, and its own spawn adds a security-hardened `--` separator
(its `sha` argument is untrusted data). `we:scripts/lane-pool.mjs`'s `cherryAllPatchEquivalent` folds every
failure to `false` and runs through its own `tryGit` helper, which layers `resolveChildTimeoutMs()`/env
restrictions uniformly across ~40 call sites in that file (no `--` separator at this particular call site —
its `upstream`/`head` arguments are locally derived, not untrusted). Re-deriving a SPAWNING primitive that
both sites call directly would either (a) drop `we:scripts/lane-pool.mjs`'s `tryGit`-supplied env/timeout
hardening for this one call site, a real behavior change, or (b) require threading each file's own execution
contract through the shared module as options, which is not what the item asks for and risks a subtle
divergence from "no behavior change."

The actual duplicated code — called out explicitly in both files' own comments
(`we:scripts/conveyor/lease-reaper.mjs`'s docblock: "one small (3-line) duplicated parse of `git cherry`'s
output … tracked as a follow-up: #xuyjss1") — is the OUTPUT PARSE, not the spawn: given raw `git cherry` stdout,
decide whether every listed commit is prefixed `-` (already patch-equivalent) or there are no lines at all.
That is the single-target primitive to extract: a pure function, `isCherryOutputAllPatchEquivalent(cherryOutput)`,
in the new `we:scripts/lib/git-patch-equivalence.mjs`. Each call site keeps its own `git cherry` spawn (options,
security separator, and null-handling all unchanged) and delegates only the parse to the shared function.

## MVP (Musts only)

- Add `we:scripts/lib/git-patch-equivalence.mjs` exporting `isCherryOutputAllPatchEquivalent(cherryOutput)`: a
  pure function, no git spawning, no new dependencies. No defensive default on a non-string input (no
  `?? ''`) — neither original inline call site had one (each called `.split(...)` directly on its own
  `exec`/`tryGit` result), so a non-string input still throws here exactly as it did before extraction, rather
  than reading as `true` ("contained"), the unsafe direction. (#4313 round-1 convergence: an earlier draft added
  `?? ''`; three independent lenses flagged it as a real, if narrow, behavior widening — fixed before land.)
- `we:scripts/conveyor/lease-reaper.mjs`'s `defaultGitIsAncestor`: replace its inline
  `lines.length === 0 || lines.every(...)` with a call to the shared function; keep its own `exec(...)` call,
  `--` separator, and `null`/`false` contract unchanged.
- `we:scripts/lane-pool.mjs`'s `cherryAllPatchEquivalent`: replace its inline parse the same way; keep
  `tryGit(...)` and its `null → false` fold unchanged.
- Unit tests for the new pure function covering: no lines (true), all `-` lines (true), a mix including one `+`
  line (false), and a trailing-newline/blank-line input (true, matching the existing `.filter(Boolean)` behavior
  both sites already relied on).
- No new exports beyond the one shared function; no change to either file's public API surface or the
  `cherryAllPatchEquivalent`/`defaultGitIsAncestor` names/signatures.

## Test plan

Each test fails before the fix (the module `we:scripts/lib/git-patch-equivalence.mjs` does not exist yet, so any
test importing it errors) and passes after:

- New: `we:scripts/lib/__tests__/git-patch-equivalence.test.mjs` — direct unit coverage of
  `isCherryOutputAllPatchEquivalent` (the four cases above).
- Regression (unmodified, must stay green): `we:scripts/conveyor/__tests__/lease-reaper.test.mjs`'s
  `#4337 — defaultGitIsAncestor …` describe blocks already exercise the cherry fallback with real git
  (squash/rebase patch-equivalence, the merge-commit blind spot, the routine content-free merge) — these prove
  `defaultGitIsAncestor` still behaves identically once its parse is delegated.
- Regression (unmodified, must stay green): `we:scripts/__tests__/lane-pool-acquire-explicit-lane-patch-equivalent.test.mjs`
  and `we:scripts/__tests__/lane-pool-squash-merge-and-litter-acquirable.test.mjs` already exercise
  `cherryAllPatchEquivalent` end to end via real git + the real CLI.

## Proof plan

Before: run the new test file — fails with a module-not-found error (the file doesn't exist). Run the two named
regression suites — pass (pre-existing, unmodified behavior). After the fix: run the new test file — passes; the
two named regression suites — still pass unmodified, proving the parse was moved, not changed. Paste the
before/after `vitest` output for the new file in the PR body.

## Follow-ups

None identified beyond this item's own scope — this is a pure single-sourcing refactor with no discovered
leftover work. If a third caller of this exact parse ever appears, extracting it in the same module is already
where it belongs.
