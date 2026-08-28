# Conveyor retry-cap staleness vs. real-failure signal

**Date**: 2026-08-28
**Point**: prep on decision #x5y1l6r found the blind counter is `planCiHealSpawns` (guard 3b), not the
originally-filed `planFixSpawns`; traced the "auto-close" to a negative result (no code in this repo
closes a PR — a human did, misled by the same false signal); and, after a skeptic sub-agent refuted the
naive fingerprint-reuse default, recommends the CI-heal agent self-report a `committedBeyondRebase` fact
on its durable comment marker instead.
**Plan file**: none — decision-prep run directly from the backlog item, not a `plans/` inbox entry.
**Research page**: `/research/conveyor-retry-cap-staleness-signal/`

---

## Question

Web Everything's conveyor mechanically dispatches AI agents to fix bounced PRs (`review:changes`) and to
heal PRs that regress on CI after being green at open (`planFixSpawns`/`planCiHealSpawns`,
`we:scripts/conveyor/tick-core.mjs`). Both cap retries at 3 attempts before handing the PR to a human. The
cap counts every dispatch identically, with no way to tell "the PR is merely behind a fast-moving `main`"
from "the fix is genuinely still broken." An observed incident: a fix's rebase kept triggering fresh CI
that found the same staleness again, four times, and the PR was closed without merging even though its
content was never actually wrong. Decision #x5y1l6r asks which signal should distinguish the two cases, and
what actually closed the PR.

## Recommendation

**Fork 1 (the only fork — see Key Findings for why the other two candidate signals dissolved): the CI-heal
agent self-reports whether it committed anything beyond the mechanical rebase, on its own durable comment
marker.** `planCiHealSpawns` caps only on attempts where that flag is true. Rejected on merit (not cost): a
contribution-fingerprint diff (`normalizeContributionFingerprint`), which has a documented false-negative
on this exact path (registry/lockfile regeneration during BEHIND-conflict resolution changes the
fingerprint despite no real change) and whose production track record was measured against a different
domain. `planFixSpawns` needs no change — its dispatches are always genuine repair attempts by construction.

## Key Findings

1. **Trace correction.** The card as filed blamed `planFixSpawns` (`we:scripts/conveyor/tick-core.mjs:383-417`).
   Re-tracing the causal chain shows the staleness-restart part of the incident routes through
   `planCiHealSpawns` (`we:scripts/conveyor/tick-core.mjs:482-516`, guard 3b, #2666) instead: a fix agent's
   dispatch is always a real repair attempt (the `review:changes` label is only ever set by a human/AI
   naming a real finding); once it re-arms to `review:pending` (a review-park label), a subsequent BEHIND
   cycle is explicitly routed to the CI-heal loop by `isCiHealTarget`
   (`we:scripts/conveyor/tick-core.mjs:207-213`), which carries its own, separate `ciHealAttempts` counter
   and `DEFAULT_CI_HEAL_RETRY_CAP`.
2. **Close mechanism traced to a negative result.** A repo-wide search (`we:scripts/**/*.mjs`,
   `we:.github/workflows/*.yml`) found no code that closes a PR — only `we:scripts/conveyor/pr-watch.mjs`
   detecting an already-closed one. `we:skills-src/conveyor/SKILL.md:496-497` states a closed PR is "a
   human abandoned it," an anomaly to investigate, never a mechanized outcome. Both retry-cap exhaustion
   notes say "run `/review N`," never close. Conclusion: a human closed the PR after repeated false-broken
   signals, not a rogue auto-close.
3. **Prior art already exists in-repo for the base-independent-content problem**, just built for a
   different purpose: `normalizeContributionFingerprint` (`we:scripts/lib/review-escalation.mjs:1192`),
   hardened across three real production false-staleness incidents (`#x9xqexm`/PR#1100, `#xalaqel`/PR#1106,
   `#x0pfbqp`) for human-review-clearance survival across the drain's own rebases. It carries one accepted
   residual (`#x413mbt`, open) justified only because a human already looked at the content once.
4. **Skeptic sub-agent refutation.** Attacking the naive "reuse the fingerprint as-is" default found a
   concrete false-negative specific to CI-heal: its brief instructs regenerating derived
   registries/lockfiles during conflict resolution, and the fingerprint only special-cases the lane
   manifest — so a purely mechanical heal can get a different fingerprint despite no real change, defeating
   the exemption for the dominant trigger. Also found the cited 0/201 production track record measured a
   different domain (drain-rebase-survival, not fix/heal attempt cycles) — an over-cited scope. Recommended
   default flipped to a direct agent self-report instead, which sidesteps both findings.
5. **Two-confusion screen: clear.** A fresh-context agent confirmed this is implementation (WE's own
   internal delivery tooling, invisible across the WE↔FUI boundary) and a genuine merit fork (raising the
   cap doesn't fix "a busy `main` can burn the whole budget on pure rebase churn before a real fix attempt
   is ever tried once" — that failure mode persists at any cap size on the status-quo branch).
6. **Care level: elevated**, derived from `deriveCareLevel`'s own signals (blast-radius alone, touching
   `we:scripts/`, bands to `elevated`; not `high` — the touched files aren't the gate-self/declarative-leash
   trust chain).

## Files Created/Modified

| File | Action |
|---|---|
| `we:backlog/x5y1l6r-name-and-handle-chasing-a-moving-target-a-fix-retry-cap-that.md` | Rewritten to the prepared-fork shape; `preparedDate` stamped |
| `we:src/_data/researchTopics/conveyor-retry-cap-staleness-signal.json` | New registry entry |
| `we:src/_includes/research-descriptions/conveyor-retry-cap-staleness-signal.njk` | New write-up |
| `we:reports/2026-08-28-conveyor-retry-cap-staleness-vs-failure.md` | This report |
