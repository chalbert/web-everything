---
name: standing-authorization-independent-review-self-clear
description: Standing authorization to spawn a genuinely independent review session when a self-authored PR is blocked by the review self-clear guard
metadata:
  node_type: memory
  type: feedback
---

When a PR this session (or one of its subagents) opened gets parked `review:pending` and is blocked from
self-clearing — because the reviewing actor's session id is the same as, or inherited from, the authoring
session's id, per the independence guard in `we:scripts/lib/review-independence.mjs` / `we:scripts/review-set-label.mjs`
— Nicolas has given STANDING authorization (2026-08-31) to resolve it by spawning a genuinely independent
review session directly, without asking for sign-off each time.

**How:** mint a fresh session id (not inherited from the current session or any of its subagents), spawn a
`claude --session-id=<fresh-uuid> -p "..."` child process running the repo's own review operation
(`we:scripts/operations/review-pr.mjs` / `we:scripts/operations/review-loop-cli.mjs` as of 2026-08-31, or
whatever supersedes it) against the PR, in its own lane — never the primary checkout, never the lane that
authored the PR. Let that independent session record whatever verdict the juror actually reaches; never force
`accept` regardless of the real finding set.

**Why:** the safety property Nicolas actually cares about is that a real, independent juror looks at the diff
and decides — not that a human personally clicks the button every time. A freshly-spawned session with its own
id already satisfies that structurally (it cannot be the same actor as the author by construction, not merely
by convention), so this specific bootstrapping case doesn't need the same case-by-case caution as a broader
unattended-trust question.

**How to apply:** use this the next time a session's own dispatched/authored PR is blocked by this exact
self-clear guard. It does NOT extend to the separate, still-gated question of whether an AGENT-tier
`autoConfirm` may answer `accept` unattended inside the review-loop machinery itself — per the epic #3383
ruling on 2026-08-31, an agent may auto-answer `changes`/`abstain` unattended but never `accept`; an accept
verdict still queues for a human to clear on their own time.
