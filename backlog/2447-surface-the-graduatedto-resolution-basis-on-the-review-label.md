---
bornAs: xutzb7q
kind: task
status: open
dateOpened: "2026-07-11"
tags: []
---

# Surface the graduatedTo resolution basis on the review/label surfaces so a valid dedup-resolve isn't misread as hollow

When a lane resolves an item via `graduatedTo` (the deliverable already landed in an earlier commit), its PR diff is **backlog-only** — a status splice plus a resolution note that lives *in the PR body*. A reviewer or label-lander scanning only the changed-file list + the `ready-to-merge` label can misread this as a **hollow resolve** and wrongly strip the label. This happened in batch-2026-07-11 (`/workflow`): #2403 / PR #421 resolved via `graduatedTo` to commit `6b5874f7` (the `deriveReviewDisposition` deliverable had already landed, a day before #2403 was opened), but the graduatedTo note was only in the PR body — so a diff-scope-only glance stripped a valid label until the body was read. Make the `graduatedTo` pointer + acceptance-mapping **visible on the surfaces where a reviewer/lander decides**, so a backlog-only diff reads as a documented dedup-resolve, not a gap.

## Build

Where a reviewer or lander sees a PR summary — the drain's review/escalation surface (`we:scripts/lib/review-core.mjs` / `we:scripts/lib/review-escalation.mjs` render path) and the `/review` + `/merge` skill PR summaries — surface the resolution basis up front when the resolve carries a `graduatedTo`: show `graduatedTo: <sha>` and a one-line "no code change — deliverable already landed in <sha>" banner, drawn from the lane manifest / resolve frontmatter, so a backlog-only diff is self-explanatory without opening the raw PR body.

## Acceptance

A `graduatedTo` resolve PR shows its resolution basis (`graduatedTo: <sha>` + "deliverable already landed") in the review/label surface a reviewer actually reads, so a backlog-only diff is not mistaken for a hollow resolve. A regression test asserts the graduatedTo banner renders for a graduatedTo resolve and is absent for a normal code resolve.
