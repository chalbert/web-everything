---
bornAs: xutzb7q
kind: task
status: active
dateOpened: "2026-07-11"
dateStarted: "2026-09-15"
tags: []
scope:
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/review-render.mjs
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
  - we:scripts/lib/__tests__/review-render.test.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
  - we:scripts/review-core-cli.mjs
  - we:scripts/__tests__/review-core-cli.test.mjs
  - we:scripts/review-detail.mjs
  - we:scripts/__tests__/review-detail.test.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/__tests__/merge-coverage.test.mjs
  - we:scripts/readiness/lane-manifest.mjs
  - we:scripts/readiness/__tests__/lane-manifest.test.mjs
  - we:scripts/lane-manifest-write.mjs
  - we:scripts/__tests__/lane-manifest-write.test.mjs
  - we:skills-src/review/SKILL.md
  - we:skills-src/merge/SKILL.md
---

# Surface the graduatedTo resolution basis on the review/label surfaces so a valid dedup-resolve isn't misread as hollow

When a lane resolves an item via `graduatedTo` (the deliverable already landed in an earlier commit), its PR diff is **backlog-only** — a status splice plus a resolution note that lives *in the PR body*. A reviewer or label-lander scanning only the changed-file list + the `ready-to-merge` label can misread this as a **hollow resolve** and wrongly strip the label. This happened in batch-2026-07-11 (`/workflow`): #2403 / PR #421 resolved via `graduatedTo` to commit `6b5874f7` (the `deriveReviewDisposition` deliverable had already landed, a day before #2403 was opened), but the graduatedTo note was only in the PR body — so a diff-scope-only glance stripped a valid label until the body was read. Make the `graduatedTo` pointer + acceptance-mapping **visible on the surfaces where a reviewer/lander decides**, so a backlog-only diff reads as a documented dedup-resolve, not a gap.

## Build

Where a reviewer or lander sees a PR summary — the drain's review/escalation surface (`we:scripts/lib/review-core.mjs` / `we:scripts/lib/review-escalation.mjs` render path) and the `/review` + `/merge` skill PR summaries — surface the resolution basis up front when the resolve carries a `graduatedTo`: show `graduatedTo: <sha>` and a one-line "no code change — deliverable already landed in <sha>" banner, drawn from the lane manifest / resolve frontmatter, so a backlog-only diff is self-explanatory without opening the raw PR body.

## Acceptance

A `graduatedTo` resolve PR shows its resolution basis (`graduatedTo: <sha>` + "deliverable already landed") in the review/label surface a reviewer actually reads, so a backlog-only diff is not mistaken for a hollow resolve. A regression test asserts the graduatedTo banner renders for a graduatedTo resolve and is absent for a normal code resolve.

## Progress

- [x] Pure derivation + banner in the ENGINE-tier `we:scripts/lib/review-render.mjs` (not the policy-tier `we:scripts/lib/review-core.mjs` / `we:scripts/lib/review-escalation.mjs`, so the change stays agent-clearable): `deriveResolutionBasis` (sources, most structured first: lane manifest → `+graduatedTo:` resolve frontmatter in the diff → the PR body's `graduatedTo:` note), `renderResolutionBasisBanner`, and `renderPanelComment({ resolutionBasis })` placing the banner above the verdict. Fires only for a known, all-`backlog/` file list and never for a cross-repo couple; `none`/empty values yield nothing. Presentation only — it feeds no gate, label, or merge decision.
- [x] `we:scripts/review-core-cli.mjs` `comment` derives/renders it (`resolutionBasis`, or raw `changedFiles` + `graduatedTo`/`manifest`/`diff`/`body`; `--graduated-to=` flag).
- [x] `we:scripts/review-detail.mjs` contract gains `resolutionBasis`; text output prints the banner under the title.
- [x] Lane manifest carries an optional, normalized `graduatedTo` (dropped, never validation-failing, when malformed); `we:scripts/lane-manifest-write.mjs` `--graduated-to=`.
- [x] Drain (`we:scripts/merge-ai-prs.mjs`): basis derived in the escalation pass off the same cumulative file set + diff text (no extra `gh` call); heads the park/skip PR comment (`withResolutionBasis`), the verdict log line, and the `--json` `toMerge`/`parked`/`skipped` entries. Non-basis PRs are byte-identical.
- [x] `/merge` + `/review` skills: lead with the resolution basis; never strip `ready-to-merge` off a backlog-only file list that carries one.
- [x] Regression tests: banner renders for a graduatedTo resolve and is absent for a code resolve (`we:scripts/lib/__tests__/review-render.test.mjs`), plus CLI (spawned), review-detail (manifest written by the real producer CLI), manifest round-trip, writer flag, and drain verdict/comment coverage.
- Not in scope (follow-up candidate): `we:scripts/operations/review-pr.mjs` (the `/review` operation's own comment render) does not yet pass `resolutionBasis` into `renderPanelComment`.
