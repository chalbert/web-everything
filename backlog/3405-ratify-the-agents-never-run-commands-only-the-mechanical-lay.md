---
bornAs: xp940qf
kind: decision
parent: "3383"
status: open
dateOpened: "2026-08-30"
relatedTo: ["3105", "3188", "3401"]
tags: [governance, conveyor, dispatch, agent-surface]
---

# Ratify the "agents never run commands, only the mechanical layer does" dispatch doctrine

## The doctrine, stated where it actually lives today

`#3383`'s own spec states the target shape plainly: *"Subagents only edit code. Every command they'd
otherwise run themselves is delegated to the mechanical layer, which queues it and reports the result
back — an agent never blocks waiting on its own shell command; it hands off and gets told the outcome."*
That is a real architectural commitment, not aspirational prose — it is already being ENFORCED in code,
but only for one narrow slice of it:

`we:scripts/guard-bash.mjs` carries a rule (`dispatchedAgentVerificationReason`, landed under `#3105`)
that denies a mechanically-dispatched agent from running the verification suite directly (`verify-lane`'s
default mode, or the declared `we:scripts/operations/run.mjs verify` operation) in any form — foreground
or background. It is gated on `WE_DISPATCH_KIND`, an env var `we:scripts/operations/dispatch-lane-io.mjs`
stamps onto every dispatched agent's spawn (`payload.launchKind`), unset — and so inert — for the
operator's own interactive session. The commit message for that change is explicit that it is
implementing "the operator's own explicit ask from earlier in this session: no raw command execution
inside a dispatched session, only a request the machinery fulfills" — i.e. the GENERAL doctrine, applied
to exactly one command (the gate) because that was the concrete case in front of the session that wrote
it.

**Nothing has ratified the general rule.** No decision card names "a dispatched agent may only edit code;
every command is delegated" as a repo-wide rule with a scope, an enforcement mechanism, and an escape
hatch for the cases that do not fit. What exists is one hand-built enforcement point for one command
(the gate), built because a concrete pain point (`#3105`'s own gate-timeout-vs-agent-window problem)
forced the question, not because the doctrine was decided first and then implemented. That is exactly
the "piecemeal enforcement without the decision" pattern `#3383`'s own follow-up section flags this as.
Captured to the learnings pool as a `missing-convention` finding
(`~/.claude/conveyor/learnings/note-20260830-091547.jsonl`) rather than harvested, since it names a
single, already-identified, already-scoped gap — filing it directly here is faster than a full pool
harvest and loses nothing a harvest pass would have added.

## Why this is a DIFFERENT question from the two adjacent cards already on the board

Two open items sit close enough to this one that ratifying this without distinguishing them would risk
either duplicating a ruling or contradicting one:

- **`#3188`** ("Should an agent session be restricted to declared operations, with bash denied by
  default") is the OPERATOR'S OWN interactive-session question, motivated by **prompt-injection blast
  radius** — "what can an agent session be induced to do." Its own measurement is explicit: of a whole
  session's work, exactly one action class went through a declared operation; everything else was raw
  bash. That measurement and its forks (deny outright vs. a read-only allowlist vs. verb-level denies;
  what happens when no operation covers the work) are about the **human-driven** session.
- **This card** is about the **conveyor's own dispatched agents** — a narrower population (mechanically
  launched, `WE_DISPATCH_KIND` set, never the operator's own interactive turns) — motivated by
  **architecture, not injection**: the whole point of `#3383` is that a dispatched agent's job is to edit
  code and hand every command off to a layer that can be watched, retried, and rate-limited from outside
  the agent's own context window. Even in a world with zero injection risk at all, dispatched agents would
  still want this doctrine, because it is what makes the mechanical supervisor (`#3398`) and the
  in-flight-guard bookkeeping (`#3403`) able to reason about "what is this agent doing right now" without
  re-deriving it from an LLM's own narration.

**These can be ratified independently, and probably should be** — #3188's verdict (whichever fork wins)
does not settle this card's scope question, and this card's verdict does not settle #3188's. If #3188
lands on "deny bash outright, everywhere," it would likely subsume this card's Fork 1(a) below; that is a
reason to cite #3188's eventual ruling when it lands, not a reason to block this card on it. Cross-linked
via `relatedTo` so whichever ratifies second has to read the other.

- **`#3401`** ("The conveyor's own dispatch-loop machinery is unregistered in TRUST_CHAIN") is a
  **different axis entirely**: it is about how much REVIEW SCRUTINY a change to the dispatch loop's own
  code gets (self-approval hazard), not about what a dispatched agent is ALLOWED TO DO at runtime. A
  dispatched agent could be perfectly doctrine-compliant (never touches a raw command) while the code
  implementing that compliance is itself under-scrutinized, which is exactly #3401's gap. This card names
  the runtime rule; #3401 names the review-tier gap on the code that enforces it. Not overlapping.

## Fork 1 — how far does "never" reach?

**Fork exists:** `#3105`'s enforcement covers exactly one command (the gate). The doctrine as stated in
`#3383` is unqualified ("every command"). A ratification has to pick a scope, because "every command,
eventually" is not itself an actionable rule — it is the aspiration the rule is supposed to serve.

- **(a) Denylist by verb-class, expand as each concrete case forces it — DEFAULT.** Keep the `#3105`
  pattern: `we:scripts/guard-bash.mjs` gains a new `WE_DISPATCH_KIND`-gated rule for each command CLASS
  that a dispatched agent should never run directly, one at a time, each with its own named reason
  (mirroring how `#3105`'s own rule names the reason: the gate outruns the agent's foreground window).
  Cheap to land incrementally, matches how the repo has actually built every other guard rule in this
  file, and never blocks on enumerating every command up front.
- **(b) Allowlist — a dispatched agent may run ONLY commands on a named safe list (read-only inspection:
  `git status`, `git log`, a test runner in read mode); everything else denied by default.** Closer to the
  letter of `#3383`'s "every command is delegated," and closer to what `#3188`'s own Fork 1(a) proposes
  for the interactive-session case — if #3188 lands on (a) there, adopting the same shape here for
  dispatched agents would be a natural, cheap follow-on (same mechanism, narrower trigger condition).
  Costs more up front: every legitimate read-only command a dispatched agent currently runs has to be
  enumerated before this can ship without breaking existing dispatch flows.
- **(c) Leave it exactly as `#3105` built it — one command, no general rule.** Cheapest, but this is the
  branch that leaves the piecemeal-enforcement gap this card exists to close; explicitly not recommended.

**Tradeoff:** (a) ships value immediately and matches this repo's own established guard-authoring
pattern, at the cost of the doctrine staying reactive (only the commands someone has hit a problem with
so far are covered) rather than structurally complete. (b) is structurally complete on day one but has a
real enumeration cost and a real risk of breaking a dispatch flow nobody remembered to allowlist.

## Fork 2 — what happens when a dispatched agent hits a command with no delegation path yet?

**Fork exists:** whichever scope Fork 1 picks, a dispatched agent will eventually need to do something
the mechanical layer has no declared operation for. This is the SAME fork `#3188` already poses for the
interactive-session case (its own Fork 2), and the two populations may reasonably want different answers.

- **(a) The dispatched agent halts and surfaces a `missing-operation` finding (mirrors the landed
  `no-hand-rolling-around-a-missing-operation` memory rule) — DEFAULT for dispatched agents
  specifically.** A dispatched agent has no person watching it turn-by-turn (that is the whole premise of
  `#3383`); silently blocking or working around the gap is worse here than for an interactive session,
  where a human could at least notice. Correct, and it costs a turn.
- **(b) An explicit, logged break-glass a human approves per use** — mirrors `#3188`'s own Fork 2(c), but
  is much less natural for a headless dispatch: there is no human in the loop to approve it synchronously,
  so this would have to route through the escalation/notification path `#3398` builds, adding a real
  latency cost to every uncovered case.

**Tradeoff:** (a) is simpler and matches how the rest of this epic already treats a missing capability
(build it, don't work around it) — the cost is a dispatched agent stalling on a gap until a human notices
the surfaced finding and builds the operation, which is exactly the escalation path `#3383`'s own "Done
when" #2 and `#3398` exist to make visible rather than silent.

## What this decision does NOT settle

The enforcement MECHANISM for any newly-scoped commands under Fork 1 — a new `we:scripts/guard-bash.mjs`
rule per command (matching `#3105`'s own precedent) is the assumed default, but a `PreToolUse` hook or a
harness-level permission mode are alternatives with different bypass properties, exactly as `#3188`'s own
"What this decision does NOT settle" section already carves out for its own case. Choose the doctrine's
scope here; the mechanism for each newly-covered command is that command's own implementation item.

## Done when

1. A ruling on Fork 1 and Fork 2 is recorded here with its reasoning.
2. `we:scripts/guard-bash.mjs`'s own header comment (or a new doc-level note near
   `dispatchedAgentVerificationReason`) is updated to cite this card as the doctrine `#3105`'s rule is
   one instance of, so a future reader of that file finds the general rule, not just the one enforced
   case.
3. If Fork 1 rules (b) (the allowlist), a COVERAGE item is filed naming the gap between today's
   dispatched-agent command surface and the allowlist — measured from real dispatch logs, not assumed.
4. The learnings-pool note this card resolves (`note-20260830-091547.jsonl`) is not re-surfaced by a
   future `/harvest` pass as still-open — either mark it consumed there, or accept that harvest will see
   this card and dedupe against it.
