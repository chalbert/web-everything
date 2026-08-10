---
name: clearing-session-must-not-edit-the-branch
description: "The session that will clear a PR must REPORT its findings, never fix them in place — a reviewer that commits to the branch co-authors the diff it would clear, so a third session is needed and the pattern recurses. Nothing in the tooling detects it: the author stamp names only whoever OPENED the PR."
metadata:
  node_type: memory
  type: feedback
---

**The rule: the final reviewer reports; it does not edit.** If a review finds a real gap, record it
(`--to=changes`, which routes the fix back to the **author lane**) and stop. Do **not** fix it in place on the
branch you are about to clear. The moment you commit to that branch you are a co-author of the diff, the
independence bar (#2439 / #2398, machine-enforced at the clearance seam by #2844) is no longer met by you, and
somebody else has to clear it. That somebody is then equally tempted to fix the next thing it finds — which is
why this only terminates if the *final* reviewer reports rather than edits.

**Observed, PR #1135** (`chalbert/web-everything`, `lane/3032-operation-engine`, merged 2026-08-10). The branch
carries `137e7892 review(#1135): pin the pre-sink pending persist the suite did not hold` — a reviewer's in-place
fix, committed during review. The PR body stamps `<!-- authored-by-actor: 01f39b97-… -->`; the durable clearance
comment stamps `<!-- cleared-by-actor: 0f03b262-… -->`. A **third** session had to be stood up to record the
verdict.

**The tooling does NOT enforce this, and the failure is silent in the permissive direction.**
`scripts/lib/review-independence.mjs` compares two ids only: the `authored-by-actor` stamp that
`scripts/pr-land.mjs` writes **once, at PR-open**, and the clearer's live `CLAUDE_CODE_SESSION_ID`. Neither it
nor `scripts/review-set-label.mjs` looks at commit authorship at all. So a reviewer from a *different* session
that fixes the branch in place and then clears it **passes** the machine check while failing the actual bar —
the check sees only who opened the PR, never who contributed to it. (What machine-refuses on a self-authored PR
is the session-identity comparison, not the fix commit; a subagent inherits its parent's session id, so a review
spawned by the authoring session is that same actor — see `skills-src/review/SKILL.md` and #3048.)

**Same principle one stage earlier**, already written down for the working-tree loop:
`skills-src/converge/SKILL.md` — *"The panel never authors what it judges. The editor writes; the NEXT round's
fresh reviewers judge."* This memory is the PR-stage twin of that line.

**Also true, and a second reason not to fix-then-clear:** a commit that rides in *after* a clearance is not
covered by it, and no marker makes it so (`skills-src/review/SKILL.md`, the `reviewed-contribution` section).

Related: [[review-parked-pr-diff-against-current-main]], [[record-verdict-before-launching-converge]],
[[humangate-review-is-not-real-escalation]].
