---
kind: decision
size: 13
status: resolved
relatedTo: ["2138", "2162", "2173", "2174", "2175", "1933", "104", "2178"]
dateOpened: "2026-07-03"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
codifiedIn: "docs/agent/platform-decisions.md#pr-flow-rollout-mechanism"
tags: [lanes, drain, workflow, pr-flow, live-preview, architecture, epic-candidate]
---

# Unify all edits behind ready-to-merge PRs; decouple (don't launch) the drain

Supersedes the narrow "flip `/workflow` to defer-by-default + skill launches a background drain"
framing this item started as. Owner-directed reframe (2026-07-03): **every edit path lands via a
ready-to-merge PR, and the drain is a fully independent, optional lander the producer never launches
or waits on.** The system must be correct with **zero drains running** — completed work simply sits
as an open PR marked ready-to-merge until *some* drain (manual `/drain`, a standing watcher, or CI
auto-merge) lands it; after any merge, local `main` pulls.

## Delivered (2026-07-03) — RESOLVED

All four slices landed, each itself produced as a ready-to-merge PR and merged by the automated `/merge`
sweep (the model dogfooding itself, zero hand-merges):

- **#2189** — `/workflow` reshaped to a **PR fan-out**; the disjoint-partition / serial-lane / write-time-lock
  machinery (#1933) retired (F2). (PR #29)
- **#2190** — `/next`, serial `/batch`, `/slice` routed through **lane-clone → ready-to-merge PR**; reshapes
  #104 (commit-on-current-branch → lane-clone-HEAD). (PR #31)
- **#2188** — `/merge` and the drain **converged on the `ready-to-merge` label** (F1) — one lander merges in
  cross-item `blockedBy` order. (PR #32)
- **#2187** — decision-authoring reconciled with #2123: **preview lane** (claim-time auto-launch), no guard
  exemption, #2123 stays uniform. (PRs #33/#34 prep, #36 ratify)

Codified as a rider under [we:docs/agent/platform-decisions.md#pr-flow-rollout-mechanism](../docs/agent/platform-decisions.md).
The forks below ratified as their defaults (F1 label, F2 drop-partition, F3 `/workflow`-first).

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

## Forks ratified (2026-07-03)

All three sub-forks ratified as their defaults:

- **F1 = PR label.** The ready-to-merge signal is a **PR label** (`ready-to-merge`), NOT a new backlog
  status — so the drain and the existing `/merge` (`we:scripts/merge-ai-prs.mjs`) converge on ONE lander
  (slice (d), #2188). The producer applies the label when it opens each PR.
- **F2 = DROP the disjoint-partition machinery.** A real reversal of #1933's disjoint-lane premise, ratified
  explicitly: with PR-per-item + a serial drain that rebase-retries, "git is the arbiter" is complete, so the
  probe/partition/serial-lane/write-time-lock machinery in
  `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` is retired. The workflow becomes a pure
  fan-out of ready-to-merge PRs; the drain serialises. Cost accepted: more rebase churn at land time when two
  PRs touch one file (the drain handles it), traded for the simplification.
- **F3 = rollout order.** `/workflow` first (this slice = spin-off (b), #2189), then serial `/batch` + `/next`
  (spin-off (c), #2190), then `/slice`; `/pr` already PR-shaped; the decision lane-at-ratify helper (spin-off
  (a), #2187) is its own slice and carries the #2123 reconcile.

Spin-offs filed: #2189 (drop-partition — the /workflow slice, implemented with this ratification), #2190
(per-path routing), #2187 (ratify→lane helper), #2188 (/merge↔drain label convergence).

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

## Interim (superseded — this landed 2026-07-03)

~~`/workflow` keeps landing inline; serial `/batch`/`/next` keep committing to main.~~ The migration is
complete: no edit path commits to `main` anymore — all land via ready-to-merge PRs (see *Delivered*).
