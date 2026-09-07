# Check the authority before asserting — most of a session's mistakes are one habit

Written after a session (2026-09-06, the open-story staleness audit) whose *findings* held up but whose
*process* produced a run of avoidable errors. They looked unrelated. They were one thing.

## The pattern

**Acting from a plausible assumption where a cheap authoritative check existed.** Every instance below cost
more to undo than the check would have cost to run.

| What I asserted | What the check would have said | Cost |
|---|---|---|
| "the operations can't be used on a VM" | `we:docs/agent/vm-sessions.md:88` documents the whole arc; `we:skills-src/review/SKILL.md:65` documents the transport | recommended a wrong fix, nearly abandoned the pipeline |
| "11 skill lines instruct raw homes" (from a bare grep) | the scan matches an *invocation*, not a mention — the real count was 0 | reported a fabricated backlog of work |
| "#3321 and #3214 are resolved-over-open-work" (from a subagent's framing) | #3214 is a ratified *decision*; #3321 is a story, and the guard is epic-only | escalated two non-defects to the operator |
| "`number-stranded` fixes this" (the error message said to run it) | it must run on **main**; in a lane the gate rejects the result the other way | half-applied rename, reverted by hand |
| used `we:scripts/backlog.mjs resolve` ×25 | `we:scripts/operations/resolve.mjs` exists and owns four guards | replayed all 25 through the operation |

The failure is never "didn't know". It is **didn't look, because a guess was available**.

## The rule

Before asserting anything about the tree — a count, a capability, a constraint, an absence — name the
authority and read it. Specifically:

- **A grep count is not a finding.** Know what the consumer actually matches before reporting a number.
  `HOME_MENTION` needs `node <path>`; a prose mention is not an instruction.
- **Read the whole skill, not its first screen.** The VM answer was 60 lines below where I stopped.
- **A subagent's framing is evidence, not a verdict.** Verify before forwarding — especially before
  escalating to a human.
- **"No CLI/credential/tool here" is a hypothesis.** The repo usually has a documented path for the
  constrained environment; look for it before declaring a dead end.
- **A remedy in an error message still has a locus.** "Run `X`" rarely means "run X anywhere".

## Why this belongs in memory rather than a gate

Two of these became guards in the same session — `number-stranded` now refuses in a lane, and lane auto-pick
now skips the caller's own lane. Most cannot be: no gate can catch "reported a grep count as a finding" or
"forwarded an unverified claim". The instances differ every time; the habit is the constant.

The tell is a sentence forming in the shape of *"X isn't possible here"* or *"there are N of these"* with no
file open. That sentence is the cue to go read something.
