---
bornAs: xo83x9i
kind: epic
parent: "3383"
status: active
dateOpened: "2026-09-01"
dateStarted: "2026-09-03"
tags: []
scope:
  - we:scripts/conveyor/
  - we:scripts/operations/
  - we:scripts/operator/
  - we:scripts/readiness/
  - we:scripts/lib/
  - we:scripts/guard-bash.mjs
  - we:scripts/lane-pool.mjs
  - we:scripts/verify-lane.mjs
  - we:scripts/__tests__/
  - we:skills-src/conveyor/
  - we:backlog/
---

# Graduate origin/lane/mechanical-dispatcher to main in small, independently reviewable pieces

origin/lane/mechanical-dispatcher (38 ahead of main, drifts session to session) has accumulated the conveyor runner/dispatch-loop infrastructure via direct pushes, not reviewed PRs -- every #3383 session update has flagged eventual graduation but never started it. Tracks that ongoing graduation: land stable, inert pieces first (e.g. the we:scripts/conveyor/review-round-tag.mjs / we:scripts/conveyor/review-status-tag.mjs informative PR labels, standalone with no we:skills-src/conveyor/runner.mjs wiring); hold back the reconcile-pass runner wiring (the continuous review-dispatch loop, commit 186801a0) until #3437's fix lands on main. Covers the whole ongoing effort, not one PR.

## Done when

1. **Executable** — `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` reports `0` on the right (lane-branch-ahead) side: every commit unique to `origin/lane/mechanical-dispatcher` has landed on `main` through its own small reviewed PR, or this item is resolved with an explicit note naming which remaining commits were deliberately dropped/superseded and why.
2. The reconcile-pass runner wiring that dispatches `review`/`fix` continuously on a tick loop (`origin/lane/mechanical-dispatcher`'s `186801a0` and anything layered on it) is not cherry-picked to `main` until `git log main -- we:scripts/conveyor/reconcile-core.mjs` shows the `#3437` name-based-bind fix (or `backlog/3437-*.md` is `status: resolved`) — landing the continuous loop before that fix would reproduce `#3437`'s live double-dispatch bug on `main`'s own runner.
3. Each landed increment is its own small PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline — never a bulk merge of the branch, and never a direct push to `main`.

## Progress

- 2026-09-03: Landed `computeFreeSlots` dirty-lane exclusion (`origin/lane/mechanical-dispatcher`'s `c7316eb40`,
  hand-reapplied onto `main`'s current `we:scripts/readiness/conveyor-state.mjs` — the branch commit didn't
  cherry-pick clean, main had independently diverged elsewhere in the same file). Confirmed already-landed via
  separate PR (content-identical, different commit shape): `26b6bbe4b`/`e603e919f`/`5c75464c1`
  (review-round-tag/review-status-tag) and `7d7e398b6`/`4d5d98365`/`d4fa4667f` (dispatch-lane fix/ci-heal
  widening, landed under #3332 instead). Still ahead on `origin/main...origin/lane/mechanical-dispatcher`:
  ~26 commits, most entangled with the held-back reconcile-pass tick-loop wiring (`186801a04`+) or with
  `we:skills-src/conveyor/supervisor.mjs` (doesn't exist on `main` yet — a bigger follow-on piece, not this PR's
  target). Next standalone candidates identified for a future increment: `we:scripts/verify-lane.mjs` request/check mode +
  `we:scripts/conveyor/verify-dispatch.mjs` (`3faf739c5` — bigger, multi-concern), `34302e2c3` (lane-pool retry
  fetch), `d37731fd7` (lane-pool flag validation).

- **2026-09-04 (recon/planning session, no build).** The branch was reconciled with `main` earlier tonight
  (a prior session took it from 97-behind/42-ahead to 0-behind, pushed as `3e4383f1c`) — this rewrote every
  commit SHA on the branch, so **every specific hash named in the 2026-09-03 entry above is now stale**; treat
  it as historical narrative only, not a lookup key. Fresh ground truth, taken right now:
  `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` → `0` behind, **30**
  ahead (not the "~26" estimated pre-reconciliation) — 46 files, +4645/-194.

  **`#3437` is confirmed `status: resolved`, and its name-based-bind fix
  (`bind review-dispatch sessions by session name, not just cwd/HEAD-oid`) is confirmed present on `main` in
  `we:scripts/conveyor/reconcile-core.mjs` today** — this item's own Done-when #2 gate is satisfied, so the
  reconcile-pass runner wiring is no longer held back; it is simply not yet sliced/landed.

  Of the 30 commits: one (`aa8c8823d`, review-round-tag/review-status-tag labels) is confirmed superseded —
  identical content already landed on `main` under a different SHA, nothing to do. One (`c30fe565b`,
  dispatch-lane fix/ci-heal widening) turns out to touch only a test file on the branch — the widening itself
  is already on `main` (landed under #3332 per the entry above); only its residual test coverage is still
  missing, folded into the dispatch-lane-hardening slice below. One (`d23678688`) is a pure merge commit
  (`we:package-lock.json` only), and one revert pair (`d281428c2`/`c24db21dd`, a live-fire test of #3412) nets
  to zero — both ignorable. Eight commits (`3003410fd`, `a2e528c14`, `4f1b19e0b`, `a178cffd0`, `2242b54b0`,
  `7793ce938`, `bbe23dcd3`, `fa3315eae`) are session-log edits to `we:backlog/3383-*.md` and
  `we:backlog/3105-*.md` — branch-local narrative that doesn't cherry-pick cleanly onto `main`'s
  independently-evolved #3383 card; not proposed as a graduation slice, any still-relevant findings should be
  folded into `main`'s #3383 card by hand as normal session-update hygiene. Two (`ef1120a32`, `011a9b912`,
  "session-reaper: ...") touch only a test file with no matching implementation change in this range —
  low-value, not sliced separately.

  **The remaining ~18 commits group into 7 slices, filed as real child stories under this item** (JIT-numbered
  hashes below; the drain assigns their `#NNN` at land):

  1. `we:scripts/lane-pool.mjs` hardening (fetch-race retry, flag validation) + `we:scripts/lib/lane-lease.mjs`
     — **we:backlog/3481-*** — standalone, unblocked, ready to build now.
  2. `we:scripts/verify-lane.mjs` request/check gate mode + `we:scripts/conveyor/verify-dispatch.mjs` (the
     "wait primitive" fork of #3105's still-open footgun decision) — **we:backlog/3484-*** — standalone,
     unblocked, ready to build now.
  3. `we:scripts/operations/dispatch-lane.mjs` and `we:scripts/operations/dispatch-lane-io.mjs` hardening
     (attempt-tagging retries #3110, residual fix/ci-heal test coverage, `WE_DISPATCH_KIND` wiring) —
     **we:backlog/3488-*** — `blockedBy: 3484` (slice 2 above; it stamps the env var slice 3 reads).
  4. Core reconcile-pass payload, split into 3 landing-ordered parts since it's the epic's largest, most
     entangled body of work: (a) `we:scripts/operations/route-pr-outcome.mjs` and
     `we:scripts/operations/route-pr-outcome-io.mjs` (new) — **we:backlog/3482-***, unblocked; (b)
     `we:skills-src/conveyor/supervisor.mjs` (new standalone daemon) — **we:backlog/3483-***,
     `blockedBy: 3482`; (c) the `we:skills-src/conveyor/runner.mjs` wiring that actually activates the
     continuous reconcile-pass tick loop — **we:backlog/3486-***, `blockedBy: 3482, 3483` — this is
     the piece Done-when #2 was gating, now unblocked by #3437, but it should still get the most scrutiny of
     any slice here and land last, validated with a single manual tick before any continuous loop runs against
     it (mirroring #3437's own Done-when #4 caution).
  5. `we:scripts/conveyor/tick-core.mjs` durable build-guard-floor fix + supervisor/runner crash-loop and
     idle-with-queue alerting hardening (#3398/#3403/#3404/#3406/#3416) — **we:backlog/3487-***,
     `blockedBy: 3483, 3486` (these are fixes layered on top of the new supervisor/runner machinery, not
     separable from it in the branch's own commit history).
  6. Follow-up (not a graduation slice, a fresh child of slice 2): fold the gate's request/check modes into the
     declared `we:scripts/operations/verify.mjs` operation, per #3224 — already fully drafted, unlanded, on the
     branch as `we:backlog/xab3jh7-*`; re-filed here as a real numbered child rather than cherry-picked
     verbatim — **we:backlog/3485-***, `blockedBy: 3484`.

  Slices 1 and 2 above are queued into the live conveyor tonight (2026-09-04) — see their own cards. Slice 3
  and the three parts of slice 4/5 are filed but intentionally NOT queued yet: their `blockedBy` edges mean
  the conveyor can't dispatch them until their prerequisite lands, and slice 4(c) in particular needs a human
  or a very deliberate agent turn at land time, not blind automated dispatch.

- **2026-09-06/07 (standing-agent iteration, heavy concurrent-activity night).** Re-measured fresh:
  `origin/main...origin/lane/mechanical-dispatcher` was `126`/`33` at the start of this pass (main had moved
  ~120 commits from unrelated concurrent work since the last measurement; the branch itself also grew by a
  few commits, mostly session-log noise plus one new `file-item` prototype unrelated to this item's scope).
  Landed this pass:

  - **#3481** (`we:scripts/lane-pool.mjs` hardening) — found ALREADY BUILT with an open-but-stuck PR (#1930,
    `CONFLICTING`/stale, opened 2026-09-05 by an earlier session and never finished). Used the finish skill:
    cloned the existing `lane/3481b-graduate-lane-pool-hardening` ref, merged `origin/main`, resolved one real
    conflict in `we:scripts/lib/__tests__/lane-lease.test.mjs` (both sides had independently added a new,
    non-overlapping `describe` block at the same insertion point — kept both), reran the full gate green,
    pushed, and landed via `we:scripts/lane-resume.mjs land`. Merged as `a57be8a09`.
  - **#3484** (`we:scripts/verify-lane.mjs` request/check mode) — same situation: open-but-stuck PR #1926
    (`CONFLICTING`, failing `review-gate` checks). Same finish-style repair: merged `origin/main`, resolved a
    real conflict in `we:scripts/guard-bash.mjs` + its test — `main` had independently landed a DIFFERENT new
    guard (`truncatedOperationJsonReason`, the `--json`-into-`head`/`tail` corruption guard, 2026-09-06) at the
    exact same insertion point as this lane's `dispatchedAgentVerificationReason` (#3105). Both are genuine,
    non-overlapping additions — kept both, in sequence, and merged their import lists. Full gate green, pushed,
    independent review dispatched via `we:scripts/operations/review-dispatch.mjs` (verdict: accept, converged
    round 1; one non-blocking test-coverage-gap finding on `fetchOriginPruneWithRetry`, filed as prose in the
    review, not a new backlog item). PR still open pending drain at the time of this note.
  - **#3483** (`we:skills-src/conveyor/supervisor.mjs`) — built fresh (not previously attempted): confirmed by
    reading the actual code, not the card's inferred grouping, that `we:skills-src/conveyor/supervisor.mjs`
    depends on nothing from the sibling `route-pr-outcome` slice — only `RUNNER_LOCK_ROOT` from
    `we:skills-src/conveyor/runner-lock.mjs` (already on `main`) and node builtins. Ported byte-identical + its
    64-test suite + the launchd example, resolved #3483, and in the same lane fixed **#3482**'s stale
    bookkeeping (`status: active` left over from an earlier session that had actually already landed its
    content under `9ff2f774c` but never flipped the card to `resolved`). Landed as PR #1978 → merged
    `1d66d33a9`.

  **Operational friction hit this pass, worth naming for the next session:** the shared lane pool was fully
  saturated (44/44 held-or-dirty) for most of this pass — both this session's own new-slice work and BOTH
  independent review dispatches (#1930, #1926) initially failed with `blocked-on-infra` before any of them got
  a lane. Recovered by `we:scripts/lane-pool.mjs provision --count=N --acquirable` (needs a large `--count` to
  push the cap past the existing pool size — `count=1` only re-checks lane-1, it does not grow the pool). Also
  hit: (a) `we:scripts/operations/run.mjs open-pr --mode=land` reads "the HEAD being landed" from the CALLING
  checkout's own `HEAD`, not from the pushed `--ref` — it must be run from inside the lane clone whose tip was
  verified, not from the primary checkout, or it spuriously reports the verification as stale; (b) a foreground
  `open-pr`/`review-pr` call that legitimately takes long (waiting on CI, or on a lane) can get killed by an
  external tool timeout mid-effect, leaving the run record's effect at `pending`/`unknown` even though the
  underlying `gh` side effect (PR opened, label swapped) already fired — recovered each time by checking the
  ACTUAL GitHub state by hand, then hand-patching that one effect's `status` field in the run record to
  `applied` or `failed` (matching reality) before `--resume`; (c) GitHub's own API rate limit was hit mid-session
  from the sheer concurrent `gh` call volume across every agent active tonight. None of this is unique to this
  item — see the freshly-filed #3553/#3554 (skill-coverage gaps for `we:scripts/conveyor/branch-sync.mjs` /
  `we:scripts/conveyor/reconcile-finding.mjs`) for related tooling gaps; a fresh item for "resume vs re-verify"
  ergonomics on `open-pr`/`review-pr` would be worth filing if this recurs.

  **Still ahead after this pass:** `origin/main...origin/lane/mechanical-dispatcher` should drop by the 3
  slices above once #3484's PR clears the drain, but the ahead-COUNT itself won't hit 0 from content landing
  alone (these land as fresh commits on `main`, not cherry-picks — this item's Done-when #1 is tracked by
  slice completion, not by the raw `git rev-list` count reaching 0 organically). Remaining unblocked/next:
  **#3488** (`we:scripts/operations/dispatch-lane.mjs`/`we:scripts/operations/dispatch-lane-io.mjs` hardening,
  `blockedBy: 3484` — now unblockable once #3484 lands) and **#3485** (fold request/check into
  `we:scripts/operations/verify.mjs`, same `blockedBy`). **#3486** (the `we:skills-src/conveyor/runner.mjs`
  reconcile-pass wiring, ~430 lines of diff remaining, a named-busy hot file tonight per this session's own
  dispatch instructions) was deliberately NOT attempted this pass — it needs the dedicated, low-contention,
  most-scrutiny turn its own card calls for, not a slot in a night this saturated. **#3487** stays
  `blockedBy: 3483, 3486` as before, now half-unblocked (3483 landed).
