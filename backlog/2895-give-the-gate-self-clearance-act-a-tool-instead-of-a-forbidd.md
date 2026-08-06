---
bornAs: x58tjn2
kind: story
size: 2
status: resolved
dateResolved: "2026-08-06"
blockedBy: ["2882"]
relatedTo: ["2285", "2439", "2644", "2945", "2946"]
scope:
  - we:scripts/review-set-label.mjs
  - we:skills-src/review/SKILL.md
  - we:scripts/__tests__/review-set-label.test.mjs
dateOpened: "2026-08-03"
graduatedTo: none
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

## Resolved 2026-08-06 — found the hard way, by walking into it

Surfaced during the `/review` of **PR #1048** (a gate-self edit to `we:scripts/lib/review-escalation.mjs`). The
operator reviewed it, said "approve", and the CLI refused — the first time a human had been blocked from
approving a PR here. Checking the history confirmed the dead end this item predicted: **PR #791** (2026-07-27)
carries BOTH `review:accepted` and `review:human`, the signature of the raw label edit, and **PR #324** /
**PR #318** merged with `review:human` still on and no approval at all. Every prior gate-self clearance used the
path #2882 closed on 2026-08-03. #1048 was the first gate-self PR to reach `/review` after that, so the operator
was the first to hit the wall. Ruled while clearing **PR #1046**, which hit the same wall and ended with a raw
`gh pr comment` + `gh pr edit` pair and a hand-copied `reviewed-sha` marker — precisely the unrecorded-command
outcome this item predicts.

### The shape: a new `--to=clear-human` target, NOT a flag on `accepted`

Decided, per this item's instruction not to default it. A `--clear-human` flag would make INVARIANT 2
*conditional* — `accepted` would sometimes clear a gate-self PR — so every future reader of the `accepted`
branch would have to check whether the lift was passed. As its own target, `accepted` stays UNCONDITIONALLY
refused on a `review:human` PR (that branch is unchanged, and a test pins it), and the clearance cannot be
reached by fumbling a flag on the ordinary accept path. A member added to a single-sourced decider is hard to
remove later, so the narrower shape won.

`clear-human` is the only target that removes `review:human`. It also drops a live `review:changes` — a cleared
PR must not still read as a bounce — and it stamps the `reviewed-sha` marker, because it IS an acceptance and
the drain must be able to refuse it later if the head advances past the cleared tree.

### The unforgeable actor signal is DEFERRED, deliberately

This item said an unforgeable actor signal "is the substance", and it was right that it is the hard part. The
finding, after three review rounds spent trying to build one, is that **no local construct is unforgeable
against an agent with shell access on the same machine**:

- a CLI flag is trivially passed;
- a local console's token is scrapeable with `curl` from the same box;
- a secret file, an env var, or a GitHub identity check are all readable, and login identity is already useless
  as an independence signal (#2439 — every commit is the same account, on one PAT). GitHub's own approval
  button is no help either: it refuses self-approval, and every PR here is the operator's account;
- **and a typed-at-a-terminal confirmation is not a barrier either.** `isatty` is a property of the file
  DESCRIPTOR, not of who is behind it: `script -q /dev/null` and `python3` `pty.fork()` both satisfy it, and
  both ship on the box. An earlier cut of this PR shipped exactly that ceremony and a reviewer defeated it in
  about ten lines. The mechanism was fine; the ambition was the problem — every round hardened the barrier, a
  reviewer walked through it, and correctly flagged the sentence claiming it was safe.

The only signals that genuinely hold are outside the agent's reach: a second account whose credentials never
touch the machine (unavailable — the constellation is solo), an out-of-band code, or a hardware human-presence
gesture. The last is the only one worth building when the time comes, and it is filed as [#2946].

So this item ships **the raw command with better manners** — and the manners are the point. What they buy: the
`reviewed-sha` stamp that stops the #983-class re-park, the attributed comment, the stated reason, and one
documented path instead of an ad-hoc paste. What was actually hurting was never the forgeability; it was that
the sanctioned act had no implementation, so the workaround always won. The aim that survives, and that this
mechanism genuinely delivers, is narrower: **stop an over-eager agent from clearing a gate-self PR by
accident** — by extending the flow it is already running. A deliberately ill-intentioned agent mimicking the
operator is out of scope, that risk is accepted, and [#2946] is where the real answer lives.

### The honesty tax, which is not optional

Because the signal is unenforced, the tool makes misuse require a lie rather than a silence:

- `clear-human` requires `--actor` AND `--reason`, both refused when absent or blank, through the same
  `{"error":…}` JSON contract every other refusal here honours. Tests pin both refusals.
- `we:skills-src/review/SKILL.md` states that an agent may invoke `clear-human` ONLY on an explicit
  in-conversation operator instruction naming that PR, and must pass that instruction verbatim as `--reason`.
  An agent clearing a PR unbidden then has to fabricate a quote, which is a far brighter line than quietly
  adding a label.
- Every surface that reports a clearance states what the record proves — that the sanctioned path was followed
  — and NOT that a human followed it. The durable comment says so in as many words, so no later reader trusts
  the record further than it earns.

**No surface in this repo may claim the clearance is unforgeable, structurally closed, or something an agent
cannot do.** That claim is what dogged this PR for three rounds and PR #1046 for four: a mechanism was removed
or defeated and its guarantee sentence stayed behind. If the mechanism changes, the sentence changes with it.

### DevX is the reason this beats a UI

The operator is already in a session with the agent; the fastest correct path is saying "accept &lt;PR&gt;" and
having the agent run one recorded command with that instruction quoted into `--reason`. A browser
context-switch to click a button is more friction, not less, and buys nothing while the signal is unenforced.
So `/review` carries the invocation directly, and the whole act — findings, marker, comment, labels — is one
command whose marker cannot be hand-copied wrong.

## Definition of done

- A human can clear a gate-self PR entirely through `we:scripts/review-set-label.mjs` via `--to=clear-human`,
  producing the label change, the `reviewed-sha` stamp, and an attributed comment stating the clearance.
- The chosen shape and the deferral of the unforgeable signal are recorded with their reasoning (above), not
  just implemented.
- `clear-human` requires `--actor` and a stated reason; tests pin that it refuses without either.
- INVARIANT 2 remains refused on every other path; a test pins that `accepted` on a `review:human` PR is still
  refused and that a caller which did not opt in cannot reach `clear-human` by naming it in argv.
- `we:skills-src/review/SKILL.md` names the tool instead of describing an act it forbids the reader from
  performing, states the explicit-instruction rule, and states plainly what a clearance record does and does
  not prove.
- `/review` carries the invocation, so the operator's in-session word is the whole act.

## Follow-ons

- [#2945] — the minimal local console, an ERGONOMICS surface for out-of-session clearance rather than a
  security one, and the natural place a gesture would later attach.
- [#2946] — the hardware human-presence gesture that would make the signal genuinely unforgeable. Filed
  `someday`: the threat it answers is an adversarial agent, not the careless one that actually bites today.
