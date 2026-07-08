---
kind: story
size: 2
relatedTo: ["2285", "2262", "2171"]
status: resolved
dateOpened: "2026-07-06"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
tags: [drain, review-escalation, human-review, surfacing]
---

# Drain park/skip reasons live only in the log, never stamped on the PR

**Observed live (2026-07-06).** A `/drain` pass parked #167 (`review:human`, gate-self edit) and skipped
#162 (merge conflict). Both decisions carry a rich reason string — *why* it needs a human and *what to look
for* — but that string is written **only to the drain's stderr log and the `--json` `parked` array**
(`we:scripts/merge-ai-prs.mjs:715-722`). The PR itself gets, at most, a bare `review:human` label (park) or
**nothing at all** (conflict skip). A human opening the PR in GitHub sees no explanation and has to
reconstruct it. The reasons had to be hand-pasted as comments after the fact.

## Why this matters

The drain log is ephemeral and lives in whoever ran the drain's terminal; the PR is where the human reviewer
actually is. The #2285-v1 invariant ("a landed PR was accepted by an agent that did not author it") and the
#2262 park gate both depend on a human being able to act on a parked PR — but we hand them the label without
the reason. Surfacing the *why + what-to-look-for* on the PR is the difference between a 30-second review and
an archaeology dig.

## Scope (both cases)

1. **Park (`review:human` / `review:pending`)** — when the gate applies a `review:*` label, also post the
   escalation reasons to the PR (a `gh pr comment`, idempotent — don't re-post on every watch pass).
2. **Conflict / non-park skip** — when the drain skips a PR for a real (non-manifest) conflict or a red
   check, leave the same one-line "why it's skipped + what to look for" on the PR, not just the log.

Keep it simple: one concise comment, deduped so a `--watch` loop doesn't spam. The reason string already
exists (`score.reasons` / the skip `reason`); this is a surfacing change, not new logic.
