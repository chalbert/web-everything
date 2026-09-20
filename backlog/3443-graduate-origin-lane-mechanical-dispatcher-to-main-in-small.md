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
     branch as `we:backlog/3636-*`; re-filed here as a real numbered child rather than cherry-picked
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

- **2026-09-19 (graduation increment, PR #2337).** Re-measured fresh after a fetch:
  `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` → **299 behind / 176
  ahead** (was 30 ahead on 2026-09-04; the branch has grown mostly through the #3383 delivery/telemetry/watchdog
  work and folded-in PRs #2156/#2223). `git cherry` finds only 8 of the 176 patch-equivalent on `main`; a
  read-only scan (temp index, `git apply --check` forward/reverse against `origin/main`) put the non-merge
  commits at 23 applying cleanly, 9 already landed (reverse-applies), the rest conflicting/entangled.

  **Landed as one small PR (#2337, `review:pending`, not merged by this session):**
  - `7760e8f1` — `we:scripts/conveyor/verify-dispatch.mjs` stops mislabelling an external kill as a ceiling
    timeout (trusts `spawnGateBounded`'s own `timedOutPhase`) + regression test. The ceiling itself was already
    on `main`.
  - `42f96a8f` + `fe04eca3` — `we:scripts/conveyor/__tests__/session-reaper-cli.test.mjs` ground-truth-axis
    coverage + its short-`id` fixture fix. Test-only: the reaper implementation is already on `main`
    (`ed9728c8d`/`436a83e56`). The two must go together — `42f96a8f` alone fails 3 tests against `main`'s reaper
    (fixtures lack `id`).
  Gate: 74/74 on the three covering vitest files; `check-standards` 8 errors, all pre-existing stranded-hash
  backlog files on `main`, none from this diff.

  **The card's named candidates are already done:** `34302e2c3`/`d37731fd7` (lane-pool retry fetch + flag
  validation) landed as #3481 (`a57be8a09`), and `3faf739c5` (verify-lane request/check + verify-dispatch) landed
  as #3484 — neither is still ahead. **Two corrections to the task framing:**
  `we:skills-src/conveyor/supervisor.mjs` is NOT absent from `main` any more (landed with #3483/PR #1978), and
  #3437 is `status: resolved` on `main`, so neither "held back" rule blocks anything now.

  **Deliberately skipped this increment:**
  - `1024822d` (#3634, reconcile-fix-dispatch falls back to PR-diff scope) — applies cleanly and stands alone, but
    it changes live fix-dispatch behaviour (adds a `gh pr diff` call); wants its own PR/scrutiny, next candidate.
  - `a035ab9e` (lease-reaper real-liveness read) — imports `resolvePidAlive`/`scanPsOutput` from
    `we:scripts/conveyor/driver-watchdog.mjs`, which is not on `main`; blocked on graduating the watchdog first.
  - The `we:skills-src/conveyor/runner.mjs` reconcile-pass wiring (#3486) and everything layered on it — still
    the highest-scrutiny piece, unchanged from the 2026-09-07 note.
  - The ~19 `backlog/`-only session-log/filing commits — branch-local narrative, not graduation slices.

  **Lane-pool bugs — no fix on the branch.** `we:scripts/lane-pool.mjs` has no non-merge commit ahead of `main`,
  and a diff of it between `origin/main` and the branch shows only `main`'s own newer changes. So neither is
  fixed on the branch: (1) `refresh --lane=N` refreshing all lanes and dying with `Permission denied
  (publickey)` on an SSH-remote lane; (2) a lane with any commit its local `origin/main` ref lacks reading as busy
  (only 1-2 of ~70 acquirable). Both need fresh work on `main`. Also seen this pass: `acquire` from the primary
  checkout failed once with `fatal: bad object refs/heads/lane/3026-…` on its `git fetch origin --prune`, and
  succeeded on an immediate retry.

  **Ahead-count:** 176 before; 177 after this tracker commit. Merging #2337 will NOT lower it — a cherry-pick lands
  as new SHAs on `main`, so the raw count only falls if the branch is later reconciled with `main`. Done-when #1 is
  still tracked by slice completion, not by the raw count.

- **2026-09-20 (graduation increment 2, PR #2344).** Measured before starting (after a fetch):
  `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` → **321 behind / 180
  ahead**. The previous increment (#2337: `7760e8f1`, `42f96a8f`, `fe04eca3`) merged 2026-09-19 (23:20Z).

  **Landed as one small PR (#2344, `review:pending`, not merged by this session):**
  - `1024822db` (#3634) — `we:scripts/conveyor/reconcile-fix-dispatch.mjs`: when a resolved item carries no
    file-level scope (an epic, e.g. #3383), `planFixesFromReconcile` falls back to the PR's own changed files
    (new `fetchPrDiffScope`, one `gh pr diff --name-only` call) as the fix-agent scope fence instead of silently
    refusing. Cherry-picked with `-x`, applied clean. A PR whose branch number is a REVIEWED PR rather than a
    delivered item stays refused (regression test pins it). Gate: 45/45 in its own test file; 73 files / 2254
    tests across it and its dependents (reconcile-core/pass/finding, parked-pr-conflict watch + integration,
    duplicate-pr-watch, all `scripts/operations/__tests__`); `check-standards` 0 errors. Behavioural (adds a `gh`
    call), so it went alone.

  **Deliberately skipped:**
  - `6bc909866`, `9e6f02578` and the rest of the watchdog chain (and `a035ab9e`, the lease-reaper liveness read
    that imports from it) — `we:scripts/conveyor/driver-watchdog.mjs` is still not on `main`; the chain has to
    graduate as its own increment, in order.
  - The `we:skills-src/conveyor/runner.mjs` reconcile-pass wiring (#3486) and everything layered on it — still
    the highest-scrutiny piece; both former hold-backs (#3437 resolved, `we:supervisor.mjs` on `main` via #3483) are
    clear, but it needs its own single-tick-validated PR.
  - The `test` heavy-admission / telemetry / usage-report / provider-registry / Antigravity commits — a large
    layered body of #3383 delivery machinery, not standalone; not sliced this pass.
  - The `backlog/`-only session-log / filing / drain-renumber commits — branch-local narrative.

  **Lane-pool bugs — still NO fix on the branch.** No non-merge commit ahead of `main` touches
  `we:scripts/lane-pool.mjs` or `we:scripts/lib/lane-lease.mjs`. Both (`refresh --lane=N` refreshing all lanes
  and dying with `Permission denied (publickey)` on an SSH-remote lane; a lane with any commit its local
  `origin/main` ref lacks reading as busy) need fresh work on `main`, not graduation.

  **Ahead-count:** 180 before this pass's start; **189 at tracker-commit time** (325 behind) — the branch grew by
  concurrent sessions' pushes while this ran, not by this pass. Merging #2344 will NOT lower it (a cherry-pick
  lands as new SHAs); Done-when #1 remains tracked by slice completion, not the raw count.

  **Friction:** the lane's `git checkout -b` is blocked by the single-branch guard, so this pass delivered from a
  throwaway full clone (with `node_modules` symlinked from the primary) — the task's "or your own throwaway clone"
  path. `git worktree add` is blocked too, so the prototype-branch tracker edit needed a second clone.

- **2026-09-20 (reaper slice PREPARED, not landed; no PR, main untouched).** The session-reaper's verdict axis exists only
  on this branch, and two live gaps (repo-less `review-<PR>` names, the unhandled `redispatch-once` rung) are fixed here
  first. Measured against `origin/main` `fe2b26a06`, the branch is 387 behind / 206 ahead.

  **Unlanded reaper commits:** `261c6c294` (session-verdicts classifier + reaper verdict axis), `9a2c50c78` (pid-dead
  axis via `driver-watchdog`), `2142bd0c0` (#77683 repair wiring; the `clear-stuck-session` operation itself is #2349),
  and this session's commit `session-reaper: resolve repo-less PR names across the constellation; name the no-handler gap`.
  `42f96a8f5`/`fe04eca38` still list as ahead but landed as #2337 (test-only) and are NOT part of this slice.

  **Not a cherry-pick.** `main`'s `we:session-reaper.mjs` moved on: its `sessionTarget` uses `parseSessionSlug`
  (`we:scripts/conveyor/session-slug.mjs`, repo-marker grammar `review-pa-148`) and its `groundTruthForPr` takes `repo`
  (default `we`). The branch has neither the grammar file nor the `repo` field on a target, so the slice is a hand-port
  onto `main`'s reaper. Two things must be re-derived there: `we:session-verdicts.mjs#dispatchGrammar` duplicates the name
  grammar and must call `parseSessionSlug` instead; and the repo-less resolution (below) needs the "unmarked" case
  told apart from "explicitly `we`", which `parseSessionSlug` does not do today (both give `repo: 'we'`).

  **What `main` lacks for the slice** (import closure checked file by file against `origin/main`):
  1. `we:scripts/conveyor/driver-watchdog.mjs` (890 lines) + `we:driver-mode.mjs` (145). The reaper imports
     `resolvePidAlive`/`scanPsOutput`/`defaultIsPidAlive`. Self-contained: every other import (`queue-store`,
     `resolve-runner-checkout`, `runner-lock`, `branch-sync`'s five named exports) is already on `main`. Commits
     `5fbc2dd53`, `39b88e26f`, `6bc909866`, `9e6f02578`. This is the "watchdog chain" earlier increments skipped; it can
     graduate first, alone, and also unblocks `a035ab9e` (lease-reaper liveness read).
  2. `we:scripts/operations/land-advance-tools.mjs` (26 lines, no imports) for `we:session-verdicts.mjs`.
  3. `we:scripts/conveyor/session-verdicts.mjs` + `we:session-verdicts-io.mjs` + their two test files.
  4. **The real blocker: `readFollowUps`.** The reaper imports it from `we:scripts/operations/land-advance-io.mjs`, which is
     not on `main` and imports 18 modules (the whole land-advance machinery). The reaper's full static import closure is 218
     files; 110 are missing from `main` (51) or differ from it (59). The function itself is 5 lines over `createFileRunStore` + `DISPATCH_EFFECT`, both on `main`.
  Tests to carry: `we:session-reaper.test.mjs`, `we:session-reaper-cli.test.mjs`, `we:session-verdicts.test.mjs`,
  `we:session-verdicts-io.test.mjs`, the driver-watchdog tests, plus `scripts/conveyor/__tests__` and
  `scripts/operations/__tests__` whole.

  **Needs an operator decision before anyone builds the slice (graduation tooling has no card for it yet):**
  - *Fork A, `readFollowUps`:* (a) extract it to a small `we:follow-up-ledger.mjs` on the branch first, leaving
    `land-advance-io` re-exporting it, then graduate that leaf (recommended: keeps the slice small and the reaper
    independent of land-advance); (b) graduate land-advance first (large, and it is the "named-busy" runner-adjacent
    area). No slice card is filed: filing goes through `file-item` and lands on `main` as a PR, which this task must not open.
  - *Fork B, unmarked names on `main`:* today `review-148` (no marker) means WE#148 by construction. Legacy sessions
    minted before markers (e.g. live `review-148` = plateau-app#148) break that. (a) keep this branch's cross-repo check
    (done only when merged in every repo where the number exists; 3 `gh` calls per unmarked PR session, capped) until the
    legacy names age out (recommended); (b) trust `we` for unmarked names and accept legacy stragglers; (c) key it on the
    session's `startedAt` against the marker cutover.
  - *Fork C, closed-unmerged:* the live `review-148` is still KEPT: WE#148 is CLOSED unmerged, plateau-app#148 MERGED, so
    "merged in every repo where it exists" is false. Treating closed as terminal (only OPEN blocks) would reap it. Pinned by
    a test so the change is made on purpose.
