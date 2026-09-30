---
bornAs: xig5d0r
kind: story
size: 3
status: active
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/review-status-tag.mjs", "we:scripts/guard-bash.mjs", "we:scripts/conveyor/fix-procedure.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/review-status-tag.test.mjs", "we:scripts/__tests__/guard-bash.test.mjs", "we:scripts/conveyor/__tests__/fix-procedure.test.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "f98b0805569a5b4c7afc244fa5b02263d5fd83ec"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2821's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2821's review (reviewed head `ed579aa5187987c1d2951583c27bcb9822b58856`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/conveyor/reconcile-core.mjs:1348` — A unit test that dispatches twice for the same PR — once right after re-arm (expect altBranch present) and once for a later, unrelated bounce (expect altBranch absent) — would catch this; none of the existing tests assert absence of altBranch on a later tick.
2. `we:scripts/conveyor/review-status-tag.mjs:99` — A review-status-tag test that supplies both a live conflict-mode fix session AND a non-null fixClaim together, asserting the result stays `fixing-conflict` — i.e. an explicit precedence test whenever a new early-return branch is inserted ahead of existing state-producing branches.
3. `we:scripts/guard-bash.mjs:2994` — Add an integration-style regression test that runs the real decide()/reason() (not the pure resolvePushDestination alone) against a live throwaway git repo for `git checkout <claimed-lane-branch> && MAIN_PUSH_OK=1 git push` while a fix claim is held, asserting refusal; more durably, make the implicit-target resolution fail-closed by refusing any bare/argless push outright whenever ANY fix claim is live in the repo, rather than trying to resolve which specific branch it targets.
4. `we:scripts/conveyor/fix-procedure.mjs` — Add a deterministic destination-resolution test matrix covering push.default=matching and remote.<name>.push refspecs, requiring every potentially updated claimed branch to be checked.
5. `we:scripts/guard-bash.mjs:3752` — Add a deterministic hook integration test with two pushes to different repositories and a claim belonging only to the second destination; resolve and enforce claims separately for every push.

## Premise check (against `main` f98b0805)

Still open and still true. `git log --all --grep` for `4326`/`4326` finds only the JIT-numbering commit; none of the five guards exists. Checked each cited site on current `main`:

- `we:scripts/conveyor/reconcile-core.mjs:1490` sets `base.altBranch = pauseState.pause.alt` whenever `concurrentAuthorPauseState` returns a not-held pause (`:297-307`). That function always picks the LAST pause comment and never expires it, so every later dispatch for the same PR re-carries the alt branch. The only existing assertions on `altBranch` are the positive ones (`we:scripts/conveyor/__tests__/fix-procedure.test.mjs:324-333`, `:377-387`).
- `we:scripts/conveyor/review-status-tag.mjs:97-101`: the `fixClaim` early return sits ahead of `liveFor(fixName)`. `we:scripts/conveyor/__tests__/fix-procedure.test.mjs:252` and `we:scripts/conveyor/__tests__/review-status-tag.test.mjs:197-217` test a claim alone or a session alone, never both together.
- `we:scripts/guard-bash.mjs:3029-3040` (arm) and `:3781-3799` (IO shell) resolve push targets ONCE, from the cwd/branch at hook time, via `we:scripts/conveyor/fix-procedure.mjs:374-410` (`resolvePushDestination`), which wraps `parseGitPush` (`:341-363`) — a single regex match, so only the FIRST `git push` in a command is ever read. Existing tests (`we:scripts/conveyor/__tests__/fix-procedure.test.mjs:160-240`) feed `reason()` hand-built `fixClaimedBranches`/`pushTargets`; nothing drives the real `decide()` + IO shell against a real repo.
- `resolvePushDestination`'s `implicit()` (`:387-396`) reads current branch, `@{push}` and `branch.<b>.merge`; it never reads `push.default` or `remote.<name>.push`, so `push.default=matching` (updates every same-named branch) and a configured push refspec are invisible to it.

## Design

Tests first; production code changes only where a new test goes red for a real reason (each case below records its expected red/green — a case that is already green is kept as a regression lock and said so in the PR).

1. **altBranch scoping** (`we:scripts/conveyor/reconcile-core.mjs:1483-1491`, test in `we:scripts/conveyor/__tests__/reconcile-core.test.mjs` or `we:scripts/conveyor/__tests__/fix-procedure.test.mjs` beside `:324`): plan the same PR twice with one pause comment — tick A right after re-arm expects `altBranch` present; tick B after the saved repair has been consumed (a later `FIX_END_MARKER`/fix completion comment, or the head moved past the pause and a fix round since completed) expects `altBranch` absent on the row. Expected RED today: `concurrentAuthorPauseState` has no notion of "consumed". Fix: treat a pause as consumed once a `FIX_BEGIN_MARKER` comment postdates it (the first post-re-arm dispatch has started and was handed the alt), reusing the SAME trusted-author filter the marker scan near `we:scripts/conveyor/reconcile-core.mjs:498` already applies — so an untrusted commenter pasting a marker cannot clear the alt. Extra cases: untrusted-author fix-begin does NOT consume; a pause with no `alt`/`createdAt` (legacy) stays unchanged; a crashed first dispatch that never posted fix-begin keeps carrying the alt.
2. **Status precedence** (`we:scripts/conveyor/__tests__/review-status-tag.test.mjs`): one case passing a live `fix-<pr>` session AND a non-null `fixClaim` with `mergeConflicted: true` → `fixing-conflict`; one with a `blocked` session + claim → still `fixing-conflict` (claim wins over the stalled suffix, as the code at `:96-101` defines); one with a live `review-<pr>` session + claim → `reviewing` (review is checked first, `:92-93`). Expected GREEN (lock in current precedence); goes red if a new branch is inserted ahead.
3. **Fail-closed on a bare push** (`we:scripts/guard-bash.mjs:3029-3040`, `:3781-3799`): extract the inline IO-shell block into an exported, injectable function (e.g. `computeFixClaimCtx(cmd, {caller, cwd, deps})` returning `{fixClaimedBranches, pushTargets}`) so `decide()` can be driven end-to-end without spawning the hook; keep the main() call site a one-liner. Then add an integration test against a real throwaway git repo (`mkdtemp` + `git init`, remote URL set to the `we` slug) with a live claim on `lane/x` held by someone else: `git checkout lane/x && MAIN_PUSH_OK=1 git push` → refused. Expected RED today: targets are resolved before the `git checkout` runs, from the stale current branch. Fix (NARROWED fail-closed): refuse when a non-own live claim exists in the push's repo AND target resolution is unreliable — a `checkout`/`switch`/`cd` precedes the push in the same command, or the push is `--all`/`--mirror`/glob. A plain bare push from an unclaimed own lane stays ALLOWED (fixers run concurrently by design; refusing every bare push whenever any claim is live would wedge them). Add a green test for that, and a second RED case at the pure `reason()` level (ctx pinned by `computeFixClaimCtx` for a command containing `checkout`/`switch`). The existing `MAIN_PUSH_OK=1 git push` + `pushTargets:['lane/unrelated']` → null test stays valid under the narrowed rule. The finding's broader "refuse every bare push while any claim is live" is deferred to Follow-ups.
4. **Destination matrix** (`we:scripts/conveyor/__tests__/fix-procedure.test.mjs`, beside `:197`): table-driven `resolvePushDestination` cases with an injected `exec`: `push.default=matching` (returns every local branch that also exists on the remote, or `*`), `remote.<name>.push=refs/heads/*:refs/heads/*` and a single-branch push refspec, `push.default=current|upstream|simple`, each asserting EVERY potentially updated claimed branch is in `branches`. Expected RED for matching and `remote.<name>.push`. Fix in `implicit()`: read `push.default` and `remote.<remote>.push`; map `matching`/glob to `*`, a concrete refspec to its destination.
5. **Multiple pushes, different repos** (`we:scripts/__tests__/guard-bash.test.mjs` or `we:scripts/conveyor/__tests__/fix-procedure.test.mjs`): `git -C A push origin lane/a && git -C B push origin lane/b` where only repo B holds a claim on `lane/b` → refused. Expected RED today: `parseGitPush` returns only the first push. Fix: add `parseGitPushes` (all pushes, each with its own remote/refspecs/`-C`); `computeFixClaimCtx` (item 3) returns a per-push array `[{repoKey, targets, claimed}]`; `reason()` in `we:scripts/guard-bash.mjs` iterates EVERY push head (today `pushHeads.find` scans only the first, so even `git push origin lane/ok && git push origin <claimed>` in one repo slips through) and denies if ANY push hits its own repo's claim. Keep a back-compat path for the existing flat `fixClaimedBranches`/`pushTargets` ctx so the current `guardReason` tests stay valid, and run the new test through real `decide()`/`reason()`, not only `parseGitPushes`. Item 4 must not over-refuse: `push.default` matching semantics apply only to bare and `<remote>`-only pushes, never an explicit `HEAD` refspec.

## MVP

Musts only: the five tests above, plus the minimal production change each red one needs (items 1, 3, 4, 5; item 2 is lock-in only). Item 3's fail-closed rule is the chosen fix over branch-by-branch resolution.

OUT of scope: a general shell-semantics model (tracking `cd`/`checkout` state across segments beyond the fail-closed rule); changing claim TTL/heartbeat behaviour; any change to `pushRefusal`'s matching of `repo: null`.

## Test plan

- `reconcile-core`/`fix-procedure` altBranch test: two planReconcile ticks, same PR — A has `altBranch`, B (after fix-end) has none. RED: today B still carries the alt.
- `review-status-tag` precedence: session+claim(+mergeConflicted) → `fixing-conflict`; blocked session+claim → `fixing-conflict`; review session+claim → `reviewing`. Green lock-in; fails if an early return is inserted ahead.
- `guard-bash` integration: real tmp repo, `git checkout <claimed> && MAIN_PUSH_OK=1 git push` with a foreign live claim → denied through real `decide()`. RED: stale-branch resolution allows it.
- `resolvePushDestination` matrix: matching / `remote.<n>.push` / current / upstream / simple. RED for the first two.
- Two-push hook test across two repos with a claim only on the second → denied; the same two pushes with no claim → allowed. RED: second push never parsed.

## Proof plan

Live before/after on this checkout's real claim store (`fixDispatchClaimRoot()`): acquire a throwaway fix claim on a scratch `lane/` branch in a scratch repo, then pipe the hook payload JSON into `node we:scripts/guard-bash.mjs` for (a) `git checkout <claimed> && MAIN_PUSH_OK=1 git push`, (b) `git push origin lane/ok && git push origin <claimed>`, (c) a `push.default=matching` bare push — capture `permissionDecision` BEFORE the change (allow) and AFTER (deny) in the PR body. The claim is shared live state: use a clearly scratch PR number and branch, a short TTL, and release in a `try/finally`; the scratch repo's remote must resolve to `we`. Prefer a test-injected `lockRoot` (as the rebase-drop tests do) if the hook can read an env override — otherwise add that small override as part of this item. Negative control: the same commands with NO claim held must stay allowed, and a bare push from an unclaimed own lane stays allowed with a claim live elsewhere. Case (a)'s deny depends on the narrowed fail-closed rule in Design item 3. Plus `npx vitest run` on the four touched test files.

## Follow-ups

- The finding's broader option: refuse EVERY bare/argless push while any fix claim is live in the repo (needs a policy call on concurrent-fixer impact).

- Model `cd`/`checkout`/`switch` state across segments so explicit-ref pushes after a checkout resolve exactly instead of via the fail-closed refusal.
- Consider a corpus entry for the guard-bash golden corpus covering the three push shapes above.
- A periodic check that every `guard-bash` ctx field computed in the IO shell has an exported, directly testable builder.

## Done when

1. **Executable** — `npx vitest run` over the four test files (`we:scripts/conveyor/__tests__/reconcile-core.test.mjs`, `we:scripts/conveyor/__tests__/review-status-tag.test.mjs`, `we:scripts/__tests__/guard-bash.test.mjs`, `we:scripts/conveyor/__tests__/fix-procedure.test.mjs`) fails before this item lands (the five new guard cases, at least cases 1, 3, 4, 5) and passes after.
