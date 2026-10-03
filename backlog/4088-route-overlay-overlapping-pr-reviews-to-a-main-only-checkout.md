---
bornAs: xoeyi0b
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["4044", "4043", "xfkqowg"]
dateOpened: "2026-09-24"
preparedDate: "2026-10-03"
preparedAgainstSha: "4a2606bc2f711efd86849e250db36b1b100a0fa4"
tags: [daemon, review, trust-chain]
scope: ["we:scripts/lib/review-overlay-route.mjs", "we:scripts/lib/__tests__/review-overlay-route.test.mjs", "we:scripts/operations/review-job.mjs", "we:scripts/operations/__tests__/review-job.test.mjs", "we:scripts/lib/daemon-clone-registry.mjs", "we:scripts/lib/__tests__/daemon-clone-registry.test.mjs", "we:scripts/review-set-label.mjs", "we:scripts/__tests__/review-set-label.test.mjs"]
---

# Route overlay-overlapping PR reviews to a main-only checkout

Build the #4043 ruling: when the review daemon runs a live overlay, any PR whose changed files overlap an active overlay is reviewed from a dedicated main-only checkout, failing closed to review:human with an alert; review-set-label --to=accepted refuses from an overlapping checkout. Closes the #809 self-approval hole for overlays (drain-daemon-self-hosting-boundary clause 3 as amended).

## Progress

Preparation (2026-10-03). The goal is unchanged (ruling #4043, Fork 1 (b)). Both blockers are resolved: #4044 (fresh rebuild plus overlays each tick) and #4043 (the ruling). The premise was corrected against current code:

- **Old premise:** review runs as a `claude --bg` session whose cwd is the daemon clone (we:scripts/operations/review-dispatch.mjs `dispatchReview`). **Corrected:** the default is now a deterministic job (x26lw6u). `we:skills-src/conveyor/review-daemon.mjs:84` imports `dispatchReviewByMode` from `we:scripts/operations/review-job.mjs`. The job's IO spawns every step with `cwd: root`, where `root = REPO_ROOT` is the daemon clone (`we:scripts/operations/review-job.mjs:226-233`). That includes `we:scripts/operations/review-loop-cli.mjs` (line 256-259), which runs the review operation, reduction and label writes. Jurors judge in their own pool lane (`--cwd=${lanePath}`), but the code that drives and records them is the clone's. So the routing seam is the job's `root` for `runLoop` and the extra-seat steps, not `dispatchReview`.
- **Overlays are live.** The overlay state for the `wev-review-daemon` clone (key `206df80ef82e6401` in the home overlay-state directory) exists, and its event log was last written 2026-10-03 09:20 (36 KB). The list is read through `we:scripts/lib/daemon-overlays.mjs#readOverlayState` (line 99), which never throws and flags `corrupt: true`.
- **No main-only clone exists yet.** `DAEMON_CLONE_SEED` (`we:scripts/lib/daemon-clone-registry.mjs:57`) lists `wev-review-daemon` but no main-only review clone. `selfSyncCheckout({ root, base: 'main' })` (`we:scripts/lib/daemon-self-sync.mjs:152`) is the existing sync primitive.
- **Old scope:** `we:scripts/operations/review-dispatch.mjs`, `we:scripts/review-set-label.mjs`, `we:skills-src/conveyor/review-daemon.mjs`, `we:scripts/lib/` (a directory). **Corrected scope:** the eight concrete files in frontmatter. `we:scripts/operations/review-dispatch.mjs` (the opt-in session mode) and `we:skills-src/conveyor/review-daemon.mjs` need no change, because the job owns `root`.
- **Overlap with open PR #3507:** `we:scripts/review-set-label.mjs` is in #3507's scope, so this card is now also blocked by xfkqowg.
- **Heartbeat:** the old Done-when 2 asked for clone freshness "in the heartbeat (#4051)". #4051 is still open, so this card writes freshness into the job record. Showing it in the heartbeat is #4051's job (see Follow-ups).

## Design

1. **Pure decision, new `we:scripts/lib/review-overlay-route.mjs`:**

   ```js
   /** @returns {{ route: 'clone'|'main-only'|'park-human', reason: string, overlapping: string[] }} */
   export function decideReviewCheckout({ prFiles, overlayState, overlayFiles, mainOnly })
   ```

   - `overlayState` is `readOverlayState(root)`.
   - `overlayFiles` maps each active overlay ref to its changed files (`git diff --name-only origin/main...<ref>` in the daemon clone). This compares by files touched, not commit identity, so a rebased or amended PR still matches.
   - `mainOnly` is `{ exists, clean, behind, headSha }`.

   Rules: no active overlays → `clone`. `corrupt` overlay state, an unreadable overlay diff, or an unreadable PR file list → `park-human` (fail closed). An overlap with a usable main-only checkout → `main-only`. An overlap with a missing, dirty or stale checkout (`behind > 0` after a sync attempt) → `park-human`.
2. **Main-only checkout.** Add `wev-review-main` to `DAEMON_CLONE_SEED` so the clone-protection guards cover it. Before use, the job calls `selfSyncCheckout({ root: mainOnlyRoot, base: 'main' })`. It never loads overlays into this clone. If the clone is missing, park; never auto-clone inside a review job.
3. **Job wiring** in `we:scripts/operations/review-job.mjs`. Before `runLoop`, read the PR files (`gh pr view --json files`), call `decideReviewCheckout`, and spawn `runLoop`/`runExtraSeats` with `cwd` set to the chosen root. `park-human` adds `review:human` through `we:scripts/lib/review-label-provider.mjs#createGhProvider` (line 117), with the reason in a comment. The job outcome is `parked`, with `reason: 'overlay-main-only-unavailable'` or `'overlay-state-unreadable'`, and a stderr alert line. The job record stores `{ route, overlapping, mainOnlyHeadSha }`.
4. **Belt and braces** in `we:scripts/review-set-label.mjs`. `--to=accepted` refuses when the running checkout's own overlay list (`readOverlayState(<script root>)`) has an active overlay whose files overlap the PR's files. A corrupt list also refuses. The error names the overlay ref and the overlapping files. No flag lifts it.

## MVP

Steps 1-4 in one PR touching the eight scoped files. Incremental and fail-closed. With no overlays loaded, behaviour is byte-identical (`route: 'clone'`). Blocked on xfkqowg (open PR #3507 edits `we:scripts/review-set-label.mjs`); otherwise ready.

## Test plan

- (RED today) `we:scripts/lib/__tests__/review-overlay-route.test.mjs`: every rule above. An amended or rebased PR whose files still overlap → `main-only`. Corrupt state → `park-human`. A stale or dirty checkout → `park-human`. No overlays → `clone`.
- (RED today) `we:scripts/operations/__tests__/review-job.test.mjs`: an overlapping PR spawns `review-loop-cli` with `cwd` equal to the main-only root (spy on the injected spawn). A missing root parks with `review:human` and records the reason. A non-overlapping PR keeps the clone root.
- (RED today) `we:scripts/lib/__tests__/daemon-clone-registry.test.mjs` (new): the seed includes `wev-review-main`, and `isDaemonCloneRealpath` recognises it.
- (RED today) `we:scripts/__tests__/review-set-label.test.mjs`: `--to=accepted` from an overlapping checkout refuses, naming the overlay. Non-overlapping and no-overlay checkouts proceed. Corrupt state refuses.
- (RED today) **Must on error:** any unreadable input (overlay state, overlay diff, PR files, main-only status) gives `park-human` or a refusal. Never a review from the overlay clone.
- (RED today) **Must for non-code:** overlap is by any file path. Docs, config, data and card files count the same as code.
- (RED today) Mutation check: drop the overlap test in `decideReviewCheckout` (always `clone`); the review-job and route suites must fail.

## Proof plan

Live, before/after: load a real overlay into `wev-review-daemon` with the existing overlay CLI (`we:scripts/daemon-overlay.mjs`, via its operation), and open its PR.

- Before (on `main`): show the review job's `review-loop-cli` running with cwd `wev-review-daemon`.
- After (this card): show the job record with `route: 'main-only'`, cwd `wev-review-main` and `mainOnlyHeadSha` equal to `origin/main`.
- Then move `wev-review-main` aside and show the `review:human` park with its alert line. Restore the clone after the check.

Paste the job records here.

## Done when

1. The four suites pass, and the mutation check fails them.
2. The live before/after evidence above is recorded on this card.
3. `npm run check:standards` passes.

## Follow-ups

- Show the main-only clone's freshness (`mainOnlyHeadSha` against `origin/main`) in the daemon heartbeat. That is #4051's surface; add it there when #4051 lands.
- Provisioning `wev-review-main` (one `git clone`) is an operator setup step for the live proof. Missing it fails closed by design.
