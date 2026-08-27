---
bornAs: xmit46t
kind: story
size: 3
status: open
scope: ["we:.github/workflows/deploy.yml"]
dateOpened: "2026-08-26"
tags: []
---

# Stamp the deployed SHA into the Worker and define the rollback path

Nothing on the deployed Worker says which commit it is, so "what is live?" is unanswerable and rollback has no target. Expose the deployed sha (a /version route or a response header) and settle the rollback mechanism — redeploy-the-previous-green-sha from git (one mechanism, git-driven) vs Cloudflare native version rollback. Prerequisite for any recovery story.

## Carries the deploy-monotonicity check (from the review of PR #1611)

Once the deployed SHA is readable, add a **monotonicity guard** to `we:.github/workflows/deploy.yml`: refuse
to deploy `DEPLOY_SHA` when it is not a descendant of the SHA currently live. This lands here rather than in
#3360 because it is unimplementable until this story exposes the live SHA.

The gap it closes, as found in review: `workflow_run` schedules the deploy by **CI-completion order, not
push order**. If commit N's CI run finishes *after* commit N+1 has already deployed, N's deploy job starts
with nothing in-progress for the `deploy-worker` concurrency group to cancel, and it silently redeploys the
**older** tree over the newer one until the next push. The ancestry assertion added in #3360 does **not**
cover this — an older commit is still a legitimate ancestor of `main`, so it passes that gate.

Judged narrow, deliberately not fixed in #3360: the `concurrency` group in `we:.github/workflows/ci.yml`
(keyed on `github.ref`, with `cancel-in-progress: true`) usually cancels the older run — which then concludes
`cancelled`, a state the deploy gate already refuses. The inversion needs the older run to report success
*after* the newer one did, and the worst case self-heals on the next push.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
