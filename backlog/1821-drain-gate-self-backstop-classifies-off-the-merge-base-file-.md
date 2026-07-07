---
kind: task
status: open
dateOpened: "2026-07-07"
relatedTo: ["2307", "2286"]
tags: [review, drain, gate-self]
---

# Drain gate-self backstop classifies off the merge-base file list — spurious review:human on stacked PRs

The drain's escalation backstop (we:scripts/merge-ai-prs.mjs via we:scripts/lib/review-escalation.mjs, isGateSelfPath) classifies a parked PR's gate-self / humanRequired from the GitHub PR *files* list — a three-dot (merge-base) diff. A stacked-pipeline PR whose NET diff (two-dot vs current main) doesn't touch the lander still lists those gate-self files (leftover from an earlier pipeline stage already landed on main), so the drain re-applies review:human and forces needless human review, defeating auto-review throughput. Observed live 2026-07-07 on PR #187 (and #186 transiently). Fix: score changedFiles off the net diff vs current main, not the raw PR files list.

## The gap (observed live)

During a drain of the 2026-07-07 pipeline batch, PR #187 (resolve #2292) was parked `review:human` with
reason `gate-self (we:scripts/merge-ai-prs.mjs)`. But #187's **net** two-dot diff vs current `main`
(`git diff origin/main..HEAD`) touched only `we:scripts/backlog/scaffold.mjs` + its tests + a backlog md —
**zero** lander code. The `we:scripts/merge-ai-prs.mjs` / `we:scripts/pr-land.mjs` hunks that tripped
`isGateSelfPath` were **three-dot / merge-base artifacts**: they came from an earlier stage of the same
stacked pipeline (#185) that had already landed on `main`, so they show in `gh pr diff` / the GitHub *files*
list (merge-base) but are net-identical to `main`. Result: a clean, agent-reviewable PR was forced onto the
human path — the exact throughput loss the auto-review flow (#2285/#2286) exists to avoid. Manual workaround
this session: re-derive the net diff with `git diff origin/main..<pr-head>` before reviewing, and read
gate-self off that.

## The fix

`scoreEscalation` / `isGateSelfPath` must be fed `changedFiles` computed as the **net two-dot diff vs the
PR's merge base target** (current `main`), not the GitHub PR files list (three-dot). Concretely: the drain
backstop should compute changed files as `main...head`'s net set (files whose content actually differs from
`main`), so a file already-landed upstream and net-unchanged doesn't count as gate-self.

## Relation to #2307 / #2286

- **#2286** built the v1 `review:human` classifier — this is a defect in it.
- **#2307** moves `review:*` tagging to producer PR-open time (deterministic labels). That would *sidestep*
  this at open (the producer classifies on the diff it is actually landing), **but #2307 explicitly keeps
  the drain's `scoreEscalation` as an idempotent backstop/reconcile** (its lines 43–47) — and that backstop
  is exactly what mis-fired here. So this fix is needed for the backstop regardless of #2307, and #2307
  should adopt the same net-diff basis when it lands. Cross-reference, don't merge.

