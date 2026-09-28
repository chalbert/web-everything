---
bornAs: xp47hpd
kind: story
size: 3
priority: high
status: resolved
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/converge-cli.mjs", "we:scripts/guard-bash.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "7b014e355619cd456edb582b4a5582f0edc39ac9"
tags: ["build-dispatch", "converge"]
---

# Build agent's converge step fails: '--state file does not exist'

we:scripts/operations/deliver-item-wrapper.mjs's runConverge (L1917-1991) calls we:scripts/converge-cli.mjs's step subcommand with --state pointing at the lane's own converge-state bookkeeping file on every loop iteration, never checking that file still exists first, and we:scripts/converge-cli.mjs's step subcommand hard-fails with no self-heal when it is gone (mustExist check, L102). On #4055/lane-4 three prior step calls against this exact bookkeeping file succeeded; only the 4th (round 1, the edit action) failed, right after runConvergeEdit spawned a full Bash+Edit+Write Claude turn with cwd=lane — whose hooks (we:scripts/guard-lane.mjs, we:scripts/guard-bash.mjs) protect nothing named that file. The wrapper's own per-round exclusion list (convergeRoundTouchedFiles in we:scripts/operations/deliver-item-wrapper.mjs) already treats converge-prefixed dotfiles as scratch it must not commit, but nothing stops that same bookkeeping file being deleted mid-loop by whatever runs inside the lane.

## Evidence (2026-09-28, live)

- Wrapper log conveyor-4055.log (delivery-dispatch-logs): `converge: --state file does not exist: we:.lanes/lane-4/.converge-state.json` followed by `deliver-item-run: #4055 FAILED (lane and claim released best-effort by the wrapper): Command failed: node we:scripts/converge-cli.mjs step --state=we:.lanes/lane-4/.converge-state.json --obs=we:.lanes/lane-4/.converge-obs-1-3.json`. The `--state=` argument DOES carry `.json` — the failure is that the file was gone, not a malformed path.
- we:scripts/converge-cli.mjs L95-103: `step` (unlike `init`) requires the state file to already exist (`mustExist`); a missing file is an immediate `fail(...)`, exit non-zero, with no fallback.
- The failing `--obs=` file is round 1, loop index 3 (we:.converge-obs-1-3.json). Per we:scripts/lib/converge-core.mjs L139 (`round: 1` at init) and the action order in we:scripts/operations/deliver-item-wrapper.mjs's `runConverge` loop (L1942-1985: read → panel → red-team → edit → invite, one `step` call closing out each), index 3 is the FIRST `edit` action of round 1 — meaning loop indices 0, 1, 2 (read/panel/red-team) each already called `step` against this exact same `--state=` path and succeeded. The file existed, was read/written three times over, then was gone by the very next call.
- The only thing that runs between the successful index-2 `step` call and the failing index-3 `step` call is `runConvergeEdit` (we:scripts/operations/deliver-item-wrapper.mjs L1962-1963), which spawns a full `claude` turn with `cwd: lane` and the Bash/Edit/Write tools (we:scripts/operations/deliver-item-wrapper.mjs L1617-1637, `DELIVERY_HOOKS_SETTINGS` L237-254) directly inside the lane's own working tree — the SAME directory the converge-state bookkeeping file lives in.
- That spawn's own hooks (we:scripts/guard-lane.mjs, we:scripts/guard-bash.mjs, we:scripts/lint-locus-prefix.mjs, we:scripts/backlog-guard.mjs) guard destructive git ops, lane ownership, and locus prefixes — none of them protects a `.converge-*` bookkeeping file from being deleted or overwritten by the very agent turn operating in that lane. we:scripts/operations/deliver-item-wrapper.mjs's own `convergeRoundTouchedFiles` (used by `commitConvergeRound`, L1728-1742) already treats `.converge-*` files as wrapper-owned scratch that must never be committed as part of the agent's diff — confirming the wrapper itself considers this file "not the agent's to touch" — but that exclusion only keeps the file OUT of commits; nothing enforces that the file must still be there.
- Ruled out: we:scripts/converge-daemon-pass.mjs's own `git reset --hard`/`git clean -fdq` refresh (which could plausibly wipe an untracked file) only ever runs against its OWN dedicated daemon clone (a separate pool, `we-converge-daemon`) and fails closed on a primary checkout or any clone with a live lease/dirty tree/unpushed commits (`assertNotPrimary`/`assertCloneNotInUse`, same file) — it is not wired to touch a pooled delivery lane like lane-4 and there is no daemon-log evidence it ran there.
- Not confirmed by a direct process trace: exactly WHAT inside the editor turn removed the file (the editor's own cleanup, a stray `git clean`/`rm` it ran, or something else in that turn) — no audit log captures file deletions inside a delivery agent's Bash calls today. The timing evidence above (3 successful calls, then a failure immediately after the one intervening operation that could touch the lane) is the strongest available signal without that trace.

## Root cause (evidenced, not directly traced)

Orchestration state (the converge-state bookkeeping file) that we:scripts/operations/deliver-item-wrapper.mjs's converge loop depends on for every `step` call lives INSIDE the same lane working tree that a full, tool-bearing agent turn (`runConvergeEdit`) is simultaneously free to modify, with no hook or lock protecting that one file. Whatever exactly removed it, the design itself is fragile: any deletion of that file by anything running in the lane — the editor agent, a stray script, a human poking at the lane — permanently wedges the converge loop with an opaque `Command failed` crash instead of a clear, attributable error, and the whole delivery aborts (claim/lane released) rather than recovering.

## Fix design

1. **Self-heal / fail clearly, not silently crash.** we:scripts/converge-cli.mjs's `step` should not have to change its own contract (failing when told to read state that isn't there is correct), but we:scripts/operations/deliver-item-wrapper.mjs's `runConverge` loop should check the state file exists immediately before each `step` call and, if it does not, fail with a clear, attributed error (e.g. "converge state file vanished between round N step M and M+1 — likely deleted by the editor turn just run") instead of letting a raw `Command failed` bubble up from a child-process exit.
2. **Move the bookkeeping file out of the harm zone.** Relocate the converge-state file (and ideally the other `.converge-*` scratch files) OUTSIDE the lane's own working tree — e.g. under the same operations coordination run-store family we:scripts/operations/run-store.mjs already uses, keyed by lane — so a tool-bearing agent operating inside the lane has no path-based reason to ever see or touch it. This is the same "don't put orchestration state where the untrusted/autonomous turn can reach it" principle we:scripts/converge-daemon-pass.mjs's own `assertCloneNotInUse` guard already applies (never refresh a clone anything else might be touching).
3. **If (2) is deferred, at minimum extend we:scripts/guard-bash.mjs's existing deny rules** (it already denies destructive git ops and main-push during a delivery dispatch) to deny any command from an editor-phase agent turn that would remove or truncate a `.converge-*`/`.delivery-*` path — mirroring the exclusion list `convergeRoundTouchedFiles` already encodes for what these files ARE, just enforced instead of just excluded-from-commits.

## Done when

1. **Executable** — a regression test that runs (or fakes) `runConverge`'s loop with an injected `run` that deletes the lane's converge-state file partway through (e.g. right after the red-team step's `step` call, before the edit action), and asserts the loop surfaces a clear, attributed failure (naming the missing state file and the round/action it happened after) rather than a raw `Command failed` exception — fails today (throws the raw child-process error), passes once (1) lands. A second test on we:scripts/converge-cli.mjs step (or the relocated-state design from (2)) proving the state file is never physically inside the lane's own working tree, once that fix lands, closes the loop.

## Progress

Both fix-design items (1) self-heal/fail-clearly and (2) relocate-the-bookkeeping landed together — with (2)
fully done, item (3)'s guard-bash deny-rule fallback is moot and was not built.

- `we:scripts/operations/deliver-item-wrapper.mjs`: new `convergeScratchDir`/`resetConvergeScratchDir` helpers
  relocate the WHOLE `.converge-*` bookkeeping family (state, obs, material, panel, red-team, invite,
  commit-message — not just the one file the incident surfaced) to a sibling directory of the lane
  (`dirname(lane)/.converge-scratch/<lane-basename>/`), wiped and recreated fresh at the start of every
  `runConverge` run so a recycled lane slot never inherits a previous item's leftover scratch. A validated,
  shared path resolver (`resolveConvergeScratchDir`) refuses an unsafe `lane` (missing/empty/filesystem-root)
  rather than risking the destructive reset collapsing onto an ancestor directory.
- `runConverge`'s loop now checks the state file's existence immediately before every `step` call and throws a
  clear, attributed error (naming the item, round, and the action that just ran) instead of letting a raw
  child-process failure bubble up unexplained — the defensive backstop item (1) asked for, now rarely needed
  given (2).
- Test suite (`we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`): existing tests updated for the
  new file locations; new regression tests reproduce the #4055 failure shape (state file deleted by the
  editor turn mid-round) and assert the clear/attributed message (confirmed RED without the fix, GREEN with
  it — see PR body), assert every bookkeeping file kind resolves outside the lane, assert a stale file from a
  recycled lane slot gets swept, and assert the unsafe-lane-path refusal.
- Converged via `/converge` (elevated care) against the real diff, two rounds: round 1's red-team surfaced a
  real security-impact gap (an unvalidated, unconditional recursive delete) and a missing-coverage gap (no
  test for the reset), both fixed in-loop; round 2 accepted with only cosmetic simplicity findings (a dead
  defensive branch, comment verbosity), also trimmed. Final verdict: land.
