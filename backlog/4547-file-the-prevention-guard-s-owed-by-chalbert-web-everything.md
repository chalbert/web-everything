---
bornAs: xaj61lx
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/land-advance-io.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/operations/__tests__/land-advance-io.test.mjs", "we:skills-src/conveyor/__tests__/review-daemon.test.mjs", "we:scripts/operations/__tests__/review-dispatch.test.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "d9c89663210907136169df01d7ce96209ff29abb"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3001's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/land-advance-io.mjs:235` — Give `dispatchReview` no silent risk defaults: require an explicit signals object, or add a test that enumerates every `dispatchReview` caller and asserts it supplies the signals.
2. `we:skills-src/conveyor/review-daemon.mjs:357` — Add one integration test from `runReviewTick` with the real `dispatchReviewByMode` in session mode and a fake spawn, asserting the `--model` argv for a statute PR.
3. `we:skills-src/conveyor/review-daemon.mjs:357` — Add an end-to-end test that passes high-care signals through dispatchReviewByMode in both modes and asserts the model. Have dispatchReviewJob reject unknown options.
4. `we:scripts/operations/review-dispatch.mjs:594` — Add a deterministic gate or test that lists security-critical path globs and asserts they resolve to Opus for review. Derive care from the diff or CODEOWNERS rather than from the PR body alone.
5. `we:skills-src/conveyor/review-daemon.mjs:358` — An integration test or strict fixture validation that ensures mock API responses match the real output shape of the underlying tool (e.g., gh pr list).
6. `we:scripts/lib/provider-routing.mjs:469` — A table-driven test that enumerates every condition explicitly stated in the policy document and asserts its correct routing outcome.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3001@a0e515d40cbc1bebbb883cfeae3476602222005f

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/land-advance-io.test.mjs we:scripts/operations/__tests__/review-dispatch.test.mjs we:scripts/operations/__tests__/review-job.test.mjs we:skills-src/conveyor/__tests__/review-daemon.test.mjs we:scripts/lib/__tests__/provider-routing.test.mjs` fails (new cases RED) before this item lands and passes after (drop the `we:` locus prefixes when typing the command).

## Progress

- 2026-10-02 prepare pass. Premise check against `origin/main` (d9c896632): goal NOT delivered. `git log -S4547` shows only the card's own filing/prepare commits. Citations drifted but the gaps are real: the `dispatchReview` call is now `we:scripts/operations/land-advance-io.mjs:235` (still passes no `careLevel`/`escalationReason`/`scopePaths`); `runReviewTick` passes them at `we:skills-src/conveyor/review-daemon.mjs:357-361`; `we:scripts/operations/review-dispatch.mjs:594-599` computes the tier via `workerTierFor`; `we:scripts/lib/provider-routing.mjs:452-471` is `workerTierFor`. Scope unchanged, plus `we:scripts/operations/review-job.mjs` and `we:scripts/operations/__tests__/review-job.test.mjs` (the real `dispatchReviewByMode`/`dispatchReviewJob` live there, not in the daemon).

## Design

The review model tier is decided in one place: `workerTierFor({kind:'review', scopePaths, risk})` (`we:scripts/lib/provider-routing.mjs:452`), called from `dispatchReview` (`we:scripts/operations/review-dispatch.mjs:594`) with `risk` derived from `careLevel` / `careLevelFromReasons(escalationReason)`. Three silent-default holes let a high-care PR fall to Sonnet:

1. **Land-advance caller** (`we:scripts/operations/land-advance-io.mjs:235`) calls `dispatchReview({pr, repo, extraArgs, actions})` with no signals, so `careLevel` defaults to `'none'` and `scopePaths` to `[]` (`we:scripts/operations/review-dispatch.mjs:542`). Fix: add a test that every production `dispatchReview` caller (found by scanning source for the call) passes the three signal keys, and make land-advance supply them for real: the owed row carries no such fields, so add an injected port `readReviewSignals(pr, repo)` (one `gh pr view --json body,files`, parsed with the existing `parseEscalationReason`) used by the review branch at `:235`; an empty value is only allowed when that read genuinely returns nothing. Also stop passing `actions` to `dispatchReview`, which does not accept it.
2. **Daemon→job path.** `dispatchReviewByMode` (`we:scripts/operations/review-job.mjs:574`) forwards `opts` to `dispatchReviewJob` (`:516`), which destructures a fixed list and silently drops `escalationReason`/`scopePaths`/`careLevel`. Fix: `dispatchReviewJob` throws on any unknown option key, accepting the three signal keys explicitly (job mode derives its model elsewhere), so a typo or new signal cannot vanish.
3. **Routing table.** `workerTierFor` has an ordered rule chain (decision, statute path, security kind/tag, `risk==='high'`, default Sonnet) covered only ad hoc. Add a table-driven test enumerating each rule and its tier.

Integration tests then pin the wiring: `runReviewTick` with the real `dispatchReviewByMode` in `mode:'session'` and a fake `spawnAgent`, asserting the `--model` argv is Opus for a statute-path PR and for a high-care body, Sonnet for an ordinary PR.

## MVP

Musts only:
- Test (and the small change it needs) that every `dispatchReview` caller supplies signals (guard 1).
- `dispatchReviewJob` rejects unknown options (guard 3, second half).
- `runReviewTick` + real `dispatchReviewByMode` session-mode integration test asserting `--model` for statute, high-care, and ordinary PRs (guards 2 and 3, first half).
- Table-driven `workerTierFor` test over every rule in the chain, including statute-tier (`we:docs/agent/` prefix) paths → Opus (partial guard 6). Guard 4 is deferred in full (there is no security-glob rule in `workerTierFor`, only a `security` tag/kind); guard 5 is deferred in full.

Everything else is deliberately out of scope → Follow-ups.

## Test plan

- Caller-enumeration test (in `we:scripts/operations/__tests__/land-advance-io.test.mjs`): scans sources for `dispatchReview(` call sites and asserts each production call passes the keys `escalationReason` and `scopePaths` (keys present; values come from the PR). Parsing: strip comments, match `dispatchReview(` call expressions, with an explicit allowlist for the internal pass-through at `we:scripts/operations/review-job.mjs` and the CLI at `we:scripts/operations/review-dispatch.mjs`; test-only/smoke callers are excluded by path, stated in the test. Capability case, RED today: the land-advance call at `:235` passes none.
- `we:scripts/operations/__tests__/review-job.test.mjs`: `dispatchReviewJob({pr, repo, bogusOption:1, root, checkStaleness, checkoutExists, spawnJob})` with all guards injected throws an error naming `bogusOption`; option keys are validated FIRST, before `planReviewDispatch`/`assertNotALaneCheckout`, so the failure cannot be a lane-checkout refusal. Capability case, RED today: the key is silently ignored and the job spawns. Before changing it, grep every caller of `dispatchReviewJob`/`dispatchReviewByMode` (daemon `dispatch` seam, tests) for extra keys and update them.
- `we:skills-src/conveyor/__tests__/review-daemon.test.mjs`: real `dispatchReviewByMode` (session mode), fake spawn; statute-path PR → Opus `--model`; high-care body → Opus; plain PR → Sonnet. Preservation cases in session mode (GREEN today: `dispatchReview` already honours both signals; mutation proof: dropping `escalationReason`/`scopePaths` from the daemon's `dispatch` call at `we:skills-src/conveyor/review-daemon.mjs:357` turns the high-care and statute cases red). Job mode is the only mode that drops them (the child gets only `--pr`/`--repo`), so add a job-mode case that asserts the spawned argv/record either carries the signals or that the dropped-signal behaviour is explicit and documented in the test; do not claim job mode honours care.
- `we:scripts/lib/__tests__/provider-routing.test.mjs`: table of (kind, taskType, scopePaths, tags, risk) → tier for every `workerTierFor` branch. Preservation case (GREEN today; `workerTierFor` already has tests that overlap, this table makes every branch explicit); mutation proof: reordering or removing a branch turns it red. This is only part of guard 6; the policy-document-derived table is a Follow-up.
- `we:scripts/operations/__tests__/review-dispatch.test.mjs`: high `careLevel` and statute `scopePaths` through `dispatchReview` yield the Opus `--model`. Preservation case (GREEN today, passes on both sides): it pins the existing `dispatchReview` tier wiring so the other changes cannot regress it; mutation proof: dropping the `risk` argument at the `workerTierFor` call turns it red.

## Proof plan

Run the five test files before (new cases red against current sources) and after (green). Live probes: (a) land-advance's review branch with a stubbed `gh` returning a statute-path PR: before, the spawned `--model` is Sonnet; after, Opus (this is the real defect); (b) `dispatchReviewJob` with a bogus option and injected guards, before: spawns; after: throws naming the option.

## Follow-ups

Each nameable as a future backlog item:
- Derive review care from the diff or CODEOWNERS instead of the PR body alone, plus a gate listing security-critical path globs that must resolve to Opus (guard 4's design half; the glob source is chosen when it is built).
- Strict fixture validation so mocked `gh pr list` responses match the real output shape (guard 5).
- A table generated from the routing policy document itself rather than hand-listed rows (guard 6 beyond `workerTierFor`).
