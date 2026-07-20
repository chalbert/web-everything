---
bornAs: xrq396a
kind: story
size: 2
status: open
dateOpened: "2026-07-20"
tags: []
---

# repo-qualify the per-PR --no-review-escalation relief target so it can't waive the wrong repo's PR

The per-PR relief valve (#2423, `parseNoReviewEscalation` / `applyEscalationRelief` in
we:scripts/merge-ai-prs.mjs) matches the relieved PR by a **bare integer** —
`escalationRelief.prs.includes(Number(v.num))` — with NO repo qualifier. But the drain sweeps all three
constellation repos in one pass (#2257), and PR numbers are per-repo. So if `web-everything#396` and
`frontierui#396` are both parked `review:pending` in the same pass, `--no-review-escalation=396` (meant for
WE#396) waives **both** — `frontierui#396` also merges unreviewed. That contradicts #2423's own headline
("relief stays scoped to one PR") and lands unreviewed code, the exact failure the escalation rubric exists to
prevent. Narrow trigger (needs two same-numbered pending parks in one pass) and a `--this-repo` workaround
exists, so it was accepted as a follow-up when PR #611 landed — not a blocker.

Surfaced by the independent `/review` of PR #611 (the #2423 landing PR), 2026-07-20.

Fix: let the flag express a repo-qualified target — accept `--no-review-escalation=owner/repo#396` (or
`repo#396`) alongside the bare `=396` form, and match on `v.repo` + `v.num` when a repo qualifier is present.
A bare `=396` may keep matching any repo (documented) or be tightened to the local/`--this-repo` slug — decide
in the fix. Tests: a repo-qualified `frontierui#396` does NOT relieve `web-everything#396` in the same pass;
a bare `=396` behaviour is pinned to whatever the fix chooses; the existing #2423 refusals
(`review:human`/`review:changes` never waivable) still hold.
