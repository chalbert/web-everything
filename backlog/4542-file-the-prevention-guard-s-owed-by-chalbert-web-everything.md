---
bornAs: xozdam8
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/verify-lane-gate.mjs", "we:scripts/lib/__tests__/verify-lane-gate.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "1839fc98ad7fe8fb2c85c7f53f1e92c1e30523fc"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2982's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/verify-lane-gate.mjs:225` — Document the ignored-file blind spot in the `computeWorkingTreeHash` docstring. If this matters, add a test that pins the behaviour, or fold a cheap signature of well-known ignored inputs (e.g. the lockfile plus the node_modules mtime) into the key. A review lens on 'cache key ⊇ gate inputs' would catch this class.
2. `we:scripts/lib/verify-lane-gate.mjs` — Add a deterministic real-git integration test that retargets an untracked symlink between identical-content files while keeping the gate command fixed, and require a cache miss; encode readlink output in the key.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2982@971268a5ac57929dd698984981fec4fd66c11f45

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/verify-lane-gate.test.mjs -t "symlink"` fails before this item lands (retarget yields an equal hash) and passes after.

## Premise check

Checked against `origin/main` @ 1839fc98: `git log --grep=4542` shows only the JIT-numbering commit, so nothing delivered. Both cited gaps are still real: `computeWorkingTreeHash` (`we:scripts/lib/verify-lane-gate.mjs:247`) hashes untracked files with `git hash-object -- <f>` (line 263), and a probe in a scratch repo confirmed `hash-object` FOLLOWS a symlink — retargeting `l -> a` to `l -> b` (a, b byte-identical) gave the same hash `78981922…`. The `fileMode` bit (S_IFLNK) differs from regular files but does not change on retarget. The docstring (lines 221-246) says nothing about gitignored inputs (`.gitignore`d lockfile-adjacent state, `node_modules`) that the gate reads but `ls-files --exclude-standard` omits. Scope (`we:scripts/lib/verify-lane-gate.mjs` + its test) is accurate; the one-line caller change in `we:scripts/verify-lane.mjs:323` is a small addition to scope.

## Design

1. **Symlink target in the key.** `computeWorkingTreeHash` gains an optional `linkTarget: (path) => string` (injected like `fileMode`). In the `untrackedDigest` map (line 262-264), when `(fileMode(f) & 0o170000) === 0o120000` the entry SKIPS `hash-object` (it follows links and throws on dangling/directory links, nulling the whole key) and uses `:link:<linkTarget(f)>` alone. If a symlink is present and `linkTarget` is not a function → return `null` (fail closed, same posture as the existing `fileMode` rule at line 258). `we:scripts/verify-lane.mjs:323` passes `linkTarget: (f) => readlinkSync(join(REPO, f))` (import `readlinkSync` beside the existing `lstatSync`).
2. **Ignored-file blind spot.** Document in the `computeWorkingTreeHash` docstring that gitignored inputs the gate may read (e.g. `node_modules`, build output) are NOT in the key by construction (`--exclude-standard`), why that is accepted (CI's full `test` check is the authority; same backstop as `laneRelevantChangeSince`'s accepted limitation), that a symlink's key covers the link text only, so content changes in its target (outside the repo or gitignored) are equally invisible, and that the key is "⊇ gate inputs" only for tracked + untracked-unignored files. No new signature (mtime-based keys hash-flap, which the existing comment at line 260 rules out).

## MVP

Musts: (a) symlink target encoded in the key + fail-closed when `linkTarget` is missing; (b) real-git integration test for the retarget case; (c) docstring paragraph for the ignored-file blind spot; (d) one-line wiring in `we:scripts/verify-lane.mjs`.
Out of scope: hashing lockfile/`node_modules` signatures; a review lens "cache key ⊇ gate inputs".

## Test plan

In `we:scripts/lib/__tests__/verify-lane-gate.test.mjs`, new `describe` using a real temp git repo (`git init`, commit, `origin/main` ref so `pinnedMergeBase` resolves), with real `runGit`, `lstatSync` mode and `readlinkSync`:
- **retarget → cache miss**: untracked `l -> a`, then `l -> b` with `a`/`b` byte-identical, gate command fixed; assert hashes differ. RED today: `hash-object` follows the link so hashes are equal.
- **dangling link**: untracked `l -> missing` still yields a non-null, stable hash (RED today: `hash-object` throws → `null`).
- **stable when unchanged** (GREEN pin, passes today): same symlink twice → equal hashes (no flap).
- **fail closed**: untracked symlink with `fileMode` but no `linkTarget` → `null`. RED today: returns a hash.
- **docstring pin** (GREEN pin, passes today): a test that an untracked ignored file (listed in `.gitignore`) does not change the hash, pinning the documented behaviour.

## Proof plan

Before/after on a real throwaway git repo via a node one-liner calling `computeWorkingTreeHash` with the real shell wiring: base commit gives equal hashes pre-fix and different hashes post-fix after `ln -sf b l`. Run `npx vitest run` on `we:scripts/lib/__tests__/verify-lane-gate.test.mjs` and `we:scripts/__tests__/verify-lane.test.mjs` green; capture the new tests FAILING against the unmodified `we:scripts/lib/verify-lane-gate.mjs` (stash only the source change) beside the green run. The real-git test runs `runGit` with `cwd` = the temp repo so `lstatSync`/`readlinkSync` resolve there; no existing test pins the `we:scripts/verify-lane.mjs:323` text (checked by grep).

## Follow-ups

- Review lens / standards check "cache key ⊇ gate inputs" for lane-verify caching.
- Optional cheap signature for well-known ignored inputs (lockfile + node_modules mtime) if the blind spot ever bites in practice.
