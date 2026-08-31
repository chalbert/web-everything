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
id satisfies the check `review-independence.mjs` actually runs — but that check is a CONVENTION, not a proof:
its own header says plainly that `CLAUDE_CODE_SESSION_ID` is "NOT an unforgeable actor signal" and that any
agent with shell access on the same machine could set `env CLAUDE_CODE_SESSION_ID=…` to fake it (the real,
durable fix is deferred to #2946, a hardware human-presence gesture). So this doesn't make self-clearing
IMPOSSIBLE, only COSTLY — it takes a deliberate forge rather than costing nothing, and the clearance record
still names both parties, so a self-clear is visible after the fact. That is the same bar `#2844`/`#2895`
already accepted as the durable one available today, not a weaker one invented here — so this specific
bootstrapping case doesn't need the same case-by-case caution as a broader unattended-trust question, but it
is not a hard guarantee either.

**How to apply:** use this the next time a session's own dispatched/authored PR is blocked by this exact
self-clear guard. It does NOT extend to the separate, still-gated question of whether an AGENT-tier
`autoConfirm` may answer `accept` unattended inside the review-loop machinery itself — per the epic #3383
ruling on 2026-08-31, an agent may auto-answer `changes`/`abstain` unattended but never `accept`; an accept
verdict still queues for a human to clear on their own time.
