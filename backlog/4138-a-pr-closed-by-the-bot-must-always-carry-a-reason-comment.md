---
bornAs: x0esjde
kind: story
size: 5
parent: "4075"
status: active
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lib/pr-merge-gate.mjs", "we:scripts/prune-landed-lanes.mjs", "we:scripts/__tests__/pr-merge-gate.test.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
tags: []
---

# A PR closed by the bot must always carry a reason comment

Live: chalbert/web-everything#2578 was closed by web-everything[bot] TWICE on 2026-09-24 with no comment on either close explaining why — 21:44:43Z (a stacked-base branch delete cascading GitHub's own auto-close, root-caused live and partly fixed by we:scripts/lib/pr-merge-gate.mjs's retargetStackedPrs, wired into we:scripts/merge-ai-prs.mjs around the merge-with---delete-branch step) and again at 23:09:55Z AFTER the PR had already been retargeted to main, so the same stacked-base mechanism cannot explain the second close — a second, still-unidentified path also closes PRs silently. Task: (1) find every code path in we:scripts/merge-ai-prs.mjs / we:scripts/lib/pr-merge-gate.mjs / we:scripts/prune-landed-lanes.mjs that can result in a PR closing (an explicit gh pr close, a --delete-branch cascade, or a GitHub auto-close on branch deletion) and (2) require every one of them to post an explanatory reason comment on the PR BEFORE (or atomically with) the action that closes it, the same discipline we:scripts/review-set-label.mjs already applies to label swaps. Reproduce the #2578 second-close live before fixing.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Findings + fix (2026-09-25)

**Every bot-close-capable path in the three named files**, per `gh api repos/chalbert/web-everything/issues/2578/timeline`:

1. `we:scripts/lib/pr-merge-gate.mjs`'s `retargetStackedPrs` (#3383) — a stacked PR whose retarget FAILS is left to GitHub's base-branch-delete cascade with no comment. This is #2578's FIRST close (21:44:43Z), already root-caused; the residual gap was its `onFailed` best-effort failure path, which only logged to stderr.
2. `we:scripts/prune-landed-lanes.mjs`'s ref delete (`gh api -X DELETE .../git/refs/heads/<branch>`) — this script had **no equivalent stacked-base guard at all**: it only ever checked whether the branch's OWN head backs an open PR, never whether some OTHER open PR is BASED on it. It is also a genuine **TOCTOU**: the open-PR snapshot is taken once at sweep start, but the actual deletes run later (after every branch's own `git merge-tree` computation), so a PR reopened/pushed in that window was invisible to the classifier. This best explains #2578's SECOND close (23:09:55Z, after retargeting to `main` — ruling out the stacked-base-on-a-drain-merge mechanism, since `main` is never deleted): a periodic prune pass computing off a stale snapshot taken during #2578's brief first-closed window.
3. No explicit `gh pr close` / `gh api -X PATCH state=closed` exists anywhere in the three files — confirmed by repo-wide grep. GitHub's own auto-close-on-branch-delete is the only closing mechanism in scope.

**Fix**:
- `we:scripts/merge-ai-prs.mjs` — `retargetStackedPrs`'s `onFailed` callback now also posts a `STACKED_BASE_CLOSE_KIND` reason comment (`buildStackedBaseCloseReason`/`buildDrainReasonComment`) on the doomed PR, in the same synchronous block, strictly BEFORE the merge write that deletes its base branch.
- `we:scripts/prune-landed-lanes.mjs` — `classifyLaneBranch` now also skips (never deletes) a branch any open PR is based on (`openPrStackedBases`, mirroring `retargetStackedPrs`'s own hazard). The delete loop additionally re-checks EVERY branch against a FRESH `gh pr list` read taken immediately before the first delete of the pass (`isStillSafeToDelete`), closing the TOCTOU window down to that one read-then-delete pair; anything the fresh check disqualifies is withheld (never deleted) and the discovered PR gets a `buildNearMissComment` reason comment (own dedupe marker) explaining the near miss — "explain after" is not viable here since GitHub refuses both retarget and reopen once a PR is actually closed this way.

Live probe: `gh pr list --repo chalbert/web-everything --state open --label ci:failed` and a direct `gh api .../issues/2578/timeline` read (both read-only) were used to confirm the mechanism; no label/comment/merge was written to the live repo by this session.
