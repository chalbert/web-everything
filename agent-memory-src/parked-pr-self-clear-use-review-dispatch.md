---
name: parked-pr-self-clear-use-review-dispatch
description: "When a subagent's own PR comes back parked review:pending/review:human and self-clear is refused, the fix is `node scripts/operations/review-dispatch.mjs --pr=<N> --repo=<owner/repo>` — not giving up, and not retrying `review-pr`/`review-loop-cli` inline, which inherits the parent session's CLAUDE_CODE_SESSION_ID and is refused every time regardless of lane/cwd."
metadata:
  type: feedback
---

**When a subagent's own build lands a PR that comes back parked `review:pending` (or `review:human`)
and the self-clear guard refuses it, do not try to review it yourself and do not report it as a dead
end — run `node scripts/operations/review-dispatch.mjs --pr=<N> --repo=<owner/repo>` (#3279).** Every
command a subagent runs — including `node scripts/operations/run.mjs review-pr ...` via Bash —
inherits the PARENT session's `CLAUDE_CODE_SESSION_ID`, so `review-pr`'s self-clear guard
(`review-independence.mjs`) correctly refuses it every single time, no matter what lane or cwd it
runs from. `review-dispatch.mjs` is the actual fix: it spawns a genuinely SEPARATE `claude --bg`
process with its own freshly-minted (not env-inherited) session id, and that dispatched session is
what gets a real independent review.

**Why:** hit live 2026-09-04, epic #3383, on PR #1902. A build subagent correctly diagnosed that it
could not get independence from inside itself — but stopped there and reported a blocker, when the
actual next step was one command away. Most of the time this doesn't come up because the resident
conveyor/drain daemon dispatches review on its own mechanically; the gap only bites when a subagent
is landing a PR by hand, outside the conveyor's own loop, as several were doing that same night (see
also [Subagent must not end turn on passive wait](subagent-must-not-end-turn-on-passive-wait.md) —
a sibling failure from the same session, both symptoms of a subagent stopping short of the next
mechanical step instead of taking it).

**How to apply:**
1. If a PR you (or your subagent) opened comes back `review:pending`/`review:human` and clearing it
   yourself is refused by the self-clear guard, that refusal is EXPECTED and not a dead end — any
   review command run by the same session (or a nested subagent of it) inherits its
   `CLAUDE_CODE_SESSION_ID` and will be refused identically every time, regardless of which lane or
   directory it runs from. Don't retry `review-pr`/`review-loop-cli` inline hoping a different cwd
   changes the outcome.
2. Run `node scripts/operations/review-dispatch.mjs --pr=<N> --repo=<owner/repo>` directly — any
   agent (the orchestrating session or a subagent) can run this; it doesn't require being a
   different pre-existing session, since it CREATES one with a fresh random UUID.
3. Let the dispatched session's independent verdict decide; never force `accept` regardless of the
   finding set (same standing constraint as
   [Standing authorization: independent review for a self-clear-blocked PR](standing-authorization-independent-review-self-clear.md)).
4. Reserve "report a blocker" for when `review-dispatch.mjs` itself fails (no `gh` credential, no
   lane capacity) — not for the self-clear refusal it exists to route around.
