---
kind: decision
size: 13
status: open
relatedTo: ["2138", "2162", "2173", "2174", "2175", "1933", "104", "2178"]
dateOpened: "2026-07-03"
tags: [lanes, drain, workflow, pr-flow, live-preview, architecture, epic-candidate]
---

# Unify all edits behind ready-to-merge PRs; decouple (don't launch) the drain

Supersedes the narrow "flip `/workflow` to defer-by-default + skill launches a background drain"
framing this item started as. Owner-directed reframe (2026-07-03): **every edit path lands via a
ready-to-merge PR, and the drain is a fully independent, optional lander the producer never launches
or waits on.** The system must be correct with **zero drains running** — completed work simply sits
as an open PR marked ready-to-merge until *some* drain (manual `/drain`, a standing watcher, or CI
auto-merge) lands it; after any merge, local `main` pulls.

## Ratified direction (2026-07-03)

1. **PR for all edits — main only ever moves via PR merge.** `/next`, `/batch`, `/slice`, `/workflow`,
   `/pr` all route edit work through a **lane clone -> ready-to-merge PR**. No more direct-to-main
   commits for edits, no inline integrate, no push-if-green. Uniform `test`-gating on every change, one
   audit trail, and a **stable live-preview `main` that only changes on merge+pull** (never churned
   mid-edit -- the core simplification).
2. **The producer never owns/launches/waits on the drain.** A workflow/batch completes when **every
   item is an open ready-to-merge PR** -- full stop. Non-blocking by construction; no background-daemon
   lifecycle (which the Workflow sandbox can't manage anyway). Correct with no drain running.
3. **The drain is an independent optional lander.** It lands ready PRs in cross-item `blockedBy` order,
   one at a time, rebase-retry on conflict (#2173/#2175 already do this). Run it whenever; a pure
   landing service, not part of any producer.
4. **Decisions are the special case: author-in-main, then lane-at-ratify.** A decision is worked
   **directly in `main`** (uncommitted) so its rendered effect is live-previewable while authored; on
   **ratify**, the diff is **moved to a lane clone -> ready PR** and `main` reverts to clean. Keeps
   main's history PR-only without losing the live-authoring loop. NOTE: the now-active #2123 lane guard
   blocks primary-tree edits, so this "author-in-main" carve-out must be reconciled with #2123 (the guard
   needs a decision-authoring exemption, or decisions author in a dedicated preview lane).

## Open sub-forks (to ratify before implementing)

- **F1 -- the ready-to-merge signal.** **Default: a PR label** (e.g. `ready-to-merge`), NOT a new backlog
  status -- because then the drain and the existing `/merge` (`we:scripts/merge-ai-prs.mjs`, which already
  sweeps green + mergeable AI-authored PRs) become the **same lander**; we don't build a second one.
  Alternative: a backlog `status: ready` the drain queries.
- **F2 -- keep or drop the disjoint-partition machinery.** **Default: DROP it.** The probe/partition
  (#1933) existed to make *direct* merges safe; with PR-per-item + a drain that serializes with
  rebase-retry, "git is the arbiter" is complete -- the workflow just fans out N PRs and the drain lands
  them one at a time. A real reversal of #1933's disjoint-lane premise, hence a fork. Alternative: keep
  partition to reduce rebase churn at land time.
- **F3 -- rollout order.** **Default:** `/workflow` first (already lane-native), then serial `/batch` and
  `/next`, then `/slice`; `/pr` already PR-shaped. Decision path (lane-at-ratify helper) as its own slice.

## Spin-off items to file on ratify

- **Ratify->lane helper** -- take an uncommitted decision diff in `main` -> apply in a lane clone -> open
  a ready PR -> revert `main` to clean. (Backs direction-point 4; must reconcile with #2123.)
- **Drop-partition** (if F2=drop) -- strip probe/partition from the orchestrator; workflow = fan-out
  ready-to-merge PRs; drain serializes. Reshapes `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`.
- **Per-path PR routing** -- route `/next`, serial `/batch`, `/slice` edit work through the lane-clone->PR
  path instead of direct-to-main commits. Reshapes #104 (commit-on-current-branch) -- clones aren't
  shared-checkout branches so it composes, but every path's close-out changes.
- **`/merge`<->drain convergence** (if F1=label) -- one lander sweeps ready-to-merge-labelled PRs.

## Acceptance

- A `/workflow` (and `/batch`, `/next`) run completes with **all items as open ready-to-merge PRs** and
  makes **zero commits to `main`**; nothing blocks on a drain.
- With **no drain running**, the PRs sit correctly and land later on the next `/drain`.
- Decisions author live in `main` (or a preview lane per the #2123 reconcile), and ratify moves the diff
  to a PR without leaving `main` dirty.
- `main` only ever advances via a PR merge; local `main` pulls after each merge.

## Supersedes / interacts

- **Supersedes** #2174's default-OFF-until-proven stance (there is no inline integrate to fall back to
  once edits are PR-only) and the earlier "skill launches a background drain" idea.
- **Reverses** #1933's disjoint-partition premise if F2=drop.
- **Reshapes** #104 (commit-on-current-branch): edit work moves to lane clones.
- **Must reconcile** with #2123 (lane guard) for the decision author-in-main carve-out.
- Builds on the resolved drain machinery (#2162/#2172/#2173/#2175) and the `/drain` + `/merge` launchers.

## Interim (until this lands)

`/workflow` keeps landing inline (the current proven path); serial `/batch`/`/next` keep committing to
main. This item is the migration off that.
