---
bornAs: x58tjn2
kind: story
size: 2
status: open
relatedTo: ["2285", "2439", "2644", "2945", "2946"]
scope:
  - we:scripts/review-set-label.mjs
  - we:skills-src/review/SKILL.md
  - we:scripts/__tests__/review-set-label.test.mjs
dateOpened: "2026-08-03"
tags: [review, gate, invariant, gate-self]
---

# Give the gate-self clearance act a tool instead of a forbidden raw command

The review skill says a human clearing a gate-self PR should drop `review:human` as a separate stated act, but no CLI target removes it and the only raw spelling is forbidden by the skill's own gate — so the sanctioned act has no sanctioned way to perform it.

## The dead end

#2882 routed `/review`'s verdict swap through `we:scripts/review-set-label.mjs` and added a `check:standards` rule forbidding a hand-rolled review-label edit in that file. Both are right. But they close a door that was the only way through:

- `decideSetLabel` has three targets — `accepted`, `changes`, `rearm`. None removes `review:human`, and `accepted` is REFUSED on a `review:human` PR (INVARIANT 2, correctly).
- The skill tells the operator to "drop `review:human` deliberately as a separate, stated act".
- The only way to do that is a raw label edit — which #2882's own gate now errors on, in that same file.

So the one act the `review:human` tier exists to enable — a human, and only a human, clearing a gate-self edit — is the one act with no tool. In practice that pushes the operator to an unrecorded command typed outside the flow, which is exactly the attribution loss the single home was built to prevent.

## Why it deserves a target rather than an exception

Clearing a gate-self PR is the highest-consequence act in the review system, so it is the one that most needs a durable, attributed record: who cleared it, against which tree, with what stated reason. A raw `gh` call produces none of that. Routing it through the module gets the `reviewed-sha` stamp and the comment for free, and turns "the operator promised to state it" into "the tool recorded it".

The design question the item must answer, not assume: is this a new `--to` target (say `clear-human`), or a flag on `accepted` (`--clear-human`) that lifts INVARIANT 2 for this one invocation? The flag form keeps one accept path and makes the lift explicit at the call site; the target form keeps `accepted` unconditionally refused on a gate-self PR, which is easier to reason about and harder to pass accidentally. Lean to the target, but decide it rather than default it — a member added to a single-sourced decider is hard to remove later.

Either way the refusal must stay unbypassable for everything else: an agent must never reach this path (#2439/#2285), so the tool needs an actor signal it cannot forge, or it is just the raw command with better manners. That constraint is the substance of the item.

## RULED 2026-08-06 — the target form, and the unforgeable signal is deferred

Both open questions above are settled. Ruled by the operator while clearing PR #1046, which hit this dead end
live: the human ended up pasting a raw `gh pr comment` + `gh pr edit` pair with a hand-copied `reviewed-sha`
marker, exactly the unrecorded-command outcome this item predicts.

**Shape: a new `--to=clear-human` target.** As the item leans. `accepted` stays unconditionally refused on a
`review:human` PR, so the refusal an agent meets is never conditional on a flag it might pass.

**The unforgeable actor signal is DEFERRED, deliberately.** There is no local construct that is unforgeable
against an agent with shell access on the same machine: a CLI flag is trivially passed, and a local console's
token can be scraped with `curl` from the same box. The only signals that genuinely hold are outside the
agent's reach — a second account whose credentials never touch the machine (unavailable: the constellation is
solo on one PAT, which is why login identity is already a useless independence signal), an out-of-band code,
or a hardware human-presence gesture. The last of those is filed separately and is the only one worth
building when the time comes.

So this item ships **the raw command with better manners** — and the manners are the point. What they buy:
the `reviewed-sha` stamp that stops the #983-class re-park, the attributed comment, the stated reason, and one
documented path instead of an ad-hoc paste. What was actually hurting was never the forgeability; it was that
the sanctioned act had no implementation, so the workaround always won.

**The honesty tax, which is not optional.** Because the signal is unenforced, the tool must make misuse
require a lie rather than a silence: `clear-human` requires `--actor` AND a stated reason, and
`we:skills-src/review/SKILL.md` must say an agent may invoke it ONLY on an explicit in-conversation operator
instruction naming that PR, quoting the instruction in the comment. An agent clearing a PR unbidden then has
to fabricate a quote, which is a far brighter line than quietly adding a label. Every surface that reports a
gate-self clearance must state what it proves — that the sanctioned path was followed, NOT that a human
followed it — so no later reader trusts the record further than it earns.

**DevX is the reason this beats a UI.** The operator is already in a session with the agent; the fastest
correct path is saying "accept &lt;PR&gt;" and having the agent run one recorded command. A browser
context-switch to click a button is more friction, not less, and buys nothing while the signal is unenforced.
`/review &lt;PR&gt; accept` should therefore wire this target so the whole ceremony — findings, marker,
comment, labels — is one invocation and the marker cannot be hand-copied wrong.

## Definition of done

- A human can clear a gate-self PR entirely through `we:scripts/review-set-label.mjs` via `--to=clear-human`,
  producing the label change, the `reviewed-sha` stamp, and an attributed comment stating the clearance.
- The chosen shape and the deferral of the unforgeable signal are recorded with their reasoning (above), not
  just implemented.
- `clear-human` requires `--actor` and a stated reason; a test pins that it refuses without them.
- INVARIANT 2 remains refused on every other path; a test pins that `accepted` on a `review:human` PR is still
  refused and that the auto-review/agent callers cannot reach `clear-human` by passing a flag to `accepted`.
- `we:skills-src/review/SKILL.md` names the tool instead of describing an act it forbids the reader from
  performing, states the explicit-instruction rule, and states plainly what a clearance record does and does
  not prove.
- `/review &lt;PR&gt; accept` invokes it, so the operator's in-session word is the whole ceremony.

## Follow-ons

- [#2945] — the minimal local console, now an ERGONOMICS surface for out-of-session clearance rather than a
  security one, and the natural place a gesture would later attach.
- [#2946] — the hardware human-presence gesture that would make the signal genuinely unforgeable. Filed
  `someday`: the threat it answers is an adversarial agent, not the careless one that actually bites today.
