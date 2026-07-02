---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: [lane, pr-flow, review, session-tooling]
relatedTo: ["2153", "2162", "2123", "2171"]
---

# Lane runs a pre-PR subagent review: fix findings hot, record dismissals in the PR body

First layer of the lane review design (session 2026-07-02, follow-on to the #2153 PR substrate). Before a lane opens its self-approved PR (`we:scripts/pr-land.mjs`), the lane session spawns an **independent subagent review over its diff** (the /code-review model — reviewer gets the diff and nothing else, no author framing in the prompt). Findings are fixed **in the lane, pre-PR**, while the author context is loaded — the cheapest place to act on them. Findings the lane dismisses are **recorded in the PR body** (never silently dropped): they are both the audit trail and a first-class input signal to the drain's escalation rubric (#2171).

Rationale: a fresh subagent has the same independent-eyes property as a separate review session for *finding* issues; the residual gap (the author judging its own findings) is covered by recording dismissals + the #2171 escalation/sampling layer. Applies to both parallel `/workflow` lanes and solo #2123 lanes — wire it at the same seam where the lane calls pr-land.

## Progress

**Resolved 2026-07-02.** Shipped the seam's two mechanical halves + the wiring at both lane types:

- **`we:scripts/lane-review.mjs`** — the pre-PR review seam. `diff` prints the exact `base…HEAD` review diff the session hands its independent review subagent (three-dot range, defaults to `origin/main`; `--stat` for the scope glance); `body` renders **dismissed** findings into a canonical, `#2171`-parseable PR-body block (`## Dismissed review findings`, one bullet per finding + reason [+ severity/location]) and composes it onto a base body → fed to `pr-land --body-file`. Pure helpers (`diffRange`/`renderDismissalsBlock`/`composeBody`/`parseDismissals`) unit-tested. The script **never calls a model** — the judgement half (spawn reviewer, accept-vs-dismiss, fix hot) is the session's, enforced by a source-level contract guard test.
- **`we:scripts/pr-land.mjs`** — added `--body-file=<path>` (a multi-line body via a CLI `--body` flag mangles the dismissals block's newlines); missing/unreadable file → falls back to `gh --fill`, never blocks a green landing.
- **Wiring — both seams (the item's "same seam" mandate):** the `/workflow` lane prompt (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` `laneItemPrompt` **step 3a**: get the diff → spawn an independent review subagent → fix accepted findings and `git commit --amend` them onto the resolve → dismissals into the new `dismissedFindings` result field, carried to the integrator/drain for the PR body), and the solo-`#2123`-lane landing seam — both codified as a rider under [`#pr-flow-rollout-mechanism`](../docs/agent/platform-decisions.md#pr-flow-rollout-mechanism).
- **Tests:** `we:scripts/__tests__/lane-review.test.mjs` (10, green) + `pr-land` unchanged (7). **Dogfooded**: this item ran the pre-PR review over its own diff before landing (dismissals, if any, recorded in its PR body).
- **Consumed by:** #2171 (the escalation rubric reads the recorded dismissals) and #2162 (the drain calls `lane-review body` → `pr-land --body-file` at the landing seam).
