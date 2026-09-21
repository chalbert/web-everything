---
bornAs: xkww2n4
kind: story
size: 3
parent: "3383"
status: open
relatedTo: ["3379", "3254", "2956", "3732"]
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lane-drain.mjs", "we:scripts/backlog.mjs", "we:scripts/__tests__/lane-drain-numbering.test.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# The drain numbers stray hash-id cards only when a PR lands, so a merge that leaves strays and no landable PR red-lights main

On 2026-09-21 the drain merged three pull requests that carried hash-named cards, and nothing numbered them. The drain numbers strays only "at land" of a later PR, so when no PR is landable the strays stay on main. Once the 180 s grace in `check:standards` ends they are errors, every lane's `verify-lane` and `open-pr` go red, and that is the very thing that keeps a PR from becoming landable: a deadlock. Make the drain number strays on every pass (or within N seconds of the merge that introduced them), whether or not a PR is landing, through the transport it already uses. The 180 s grace stays. Relates #3379 (its findings 1 and 3 are the same miss on other PR shapes), #3254 (`number-stranded` racing the drain: the new pass must take the same numbering lock), #2956 (the grace), #3732 (prevention; this is the repair backstop).

## FOUND (2026-09-21)

- **The evidence.** PR 2400 (four hash-named cards) merged at 19:24Z. After the grace ended, `check:standards` on main reported 4 "stranded hash" errors, so every web-everything lane's `verify-lane` and `open-pr` went red. Three workers stopped: `amend-orchestration-cards`, `fix-pr-2388`, `prepare-wip-gate-deeplink`. It recurred after PR 2406 (six cards) and PR 2403 (two cards). The drain log shows the numbering only ever arriving with a later land: `drain: JIT-number x3pvhaf→#3806 ... at land (#2288)`.
- **The gate.** In `we:scripts/merge-ai-prs.mjs` (~4609) `landedLocal` is true only when this pass merged a PR to the local repo, and the numbering block (~4671, `if (landedLocal && !DRY_RUN)`) is inside it: `withNumberingLock` then `numberPendingHashes(process.cwd())`, best-effort. A pass that merges nothing never enters it. `finalizeLand` in `we:scripts/lane-drain.mjs` (~850-882) is the same shape: number, then `publishMain`, after a land.
- **The publish route.** `publishMain` (`we:scripts/lane-drain.mjs`, ~842) runs `push-if-green` with `--assume-green --json` (`we:scripts/push-if-green.mjs`). That is by construction: the full gate cannot pass a numbering commit, because `check:standards` rejects the new numbers as "hand-picked NNN not on origin/main".
- **The manual repair that worked.** `number-stranded` (`we:scripts/backlog.mjs`) in a NON-lane checkout (lanes refuse), then `push-if-green` with `--assume-green`. #3254 records that a manual run can race the drain's own numbering commit; the new pass must serialize with it.
- **Not a duplicate.** #2348, #2419 and #2956 (resolved) fixed numbering on a land from a detached or stale lane and made the gate tolerate the drain's own window; #3379 asks that a merge path number every card in the PR it is merging. None makes the drain number strays when nothing lands.

## Done when

1. **Executable** — a new test file `we:scripts/__tests__/drain-numbers-strays-without-landing.test.mjs` (throwaway git repo, as `we:scripts/__tests__/lane-drain-numbering.test.mjs` does) seeds a `main` holding a stray hash-named card with NO landable PR, runs ONE drain pass, and asserts the card is numbered, its references rewritten, and the numbering commit pushed through the same `publishMain` transport. Run it with `npm run test:unit` on that file: it fails today (the pass leaves the stray) and passes after.
2. **Executable** — a second case in the same file: a pass on a `main` with NO stray hash-named card is a no-op (no commit, no push, nothing written).
3. **Executable** — a third case: the pass runs inside `withNumberingLock`, exactly as the at-land pass does, so a lock held by another writer is reported as contended the same way (the #3254 race); the new pass adds no unlocked route.
4. The 180 s grace in `check:standards` is unchanged (`git diff` shows no edit to the grace constant).
