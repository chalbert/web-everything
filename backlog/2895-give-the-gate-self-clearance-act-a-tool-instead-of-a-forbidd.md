---
bornAs: x58tjn2
kind: story
size: 2
status: resolved
dateResolved: "2026-08-06"
blockedBy: ["2882"]
relatedTo: ["2285", "2439", "2644"]
scope:
  - we:scripts/review-set-label.mjs
  - we:skills-src/review/SKILL.md
  - we:scripts/__tests__/review-set-label.test.mjs
  - we:scripts/__tests__/review-clear-human-pty.test.mjs
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

- A human can clear a gate-self PR entirely through `we:scripts/review-set-label.mjs`, producing the label change, the `reviewed-sha` stamp, and an attributed comment stating the clearance.
- The chosen shape (new target vs flag on `accepted`) is recorded with its reasoning, not just implemented.
- INVARIANT 2 remains refused on every other path; a test pins that the new path cannot be reached by the auto-review/agent callers.
- `we:skills-src/review/SKILL.md` names the tool instead of describing an act it forbids the reader from performing.

## Resolved 2026-08-05 — found the hard way, by walking into it

Surfaced during the `/review` of **PR #1048** (a gate-self edit to `we:scripts/lib/review-escalation.mjs`). The
operator reviewed it, said "approve", and the CLI refused — the first time a human had been blocked from
approving a PR here. Checking the history confirmed the dead end this item predicted: **PR #791** (2026-07-27)
carries BOTH `review:accepted` and `review:human`, the signature of the raw label edit, and **PR #324** /
**PR #318** merged with `review:human` still on and no approval at all. Every prior gate-self clearance used the
path #2882 closed on 2026-08-03. #1048 was the first gate-self PR to reach `/review` after that, so the operator
was the first to hit the wall.

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

### The actor signal: a typed confirmation at a terminal — a speed bump, not a wall

This item said an unforgeable actor signal "is the substance", and it was right to. The honest finding is that
in a solo constellation **nothing is truly unforgeable**: the agent runs on the operator's machine, with the
operator's PAT, with read access to the whole filesystem. A secret file, an env var, and a GitHub identity check
are all forgeable, and login identity is already useless as an independence signal (#2439 — every commit is the
same account). GitHub's own review-approval button is no help either: it refuses self-approval, and every PR
here is the operator's account.

So `clear-human` refuses unless stdin is a terminal AND the operator types the **PR number** (not `y` — the
highest-consequence act in the review system must not be reachable by a fat-finger).

**What that terminal check is and is not is stated ONCE, in the code**, at
`we:scripts/review-set-label.mjs#decideHumanCeremony`. Read it there; this note deliberately does not restate
it, and neither does `we:skills-src/review/SKILL.md`. The short version, so this paragraph is not misleading on
its own: it is a **deliberate speed bump** that stops an agent from clearing its own homework *incidentally*; an
agent that **deliberately** allocates a pseudo-terminal defeats it, and the durable fix is the UI-with-auth
successor below.

Reachability is closed on the caller side too, and this is where the first cut was wrong. `clear-human` is
reachable only when the caller sets `allowClearHuman: true`, which only this file's own `IS_CLI` block does, and
the ceremony itself is module-private. The conveyor fix agent pins `fixedTo: 'rearm'` and never opts in, so it
cannot name the target even by constructing the argv by hand — pinned by a behavioural test that drives the
harness and reads the refusal, not by a source grep.

**This is interim, and the code says so.** The durable home for the signal is a UI with its own auth, where "a
human did it" is a property of an authenticated session rather than of the input device. Until that exists the
terminal is the only place where "the operator did it" and "an agent did it" differ at all. The operator's call
was to take the terminal gate now on the grounds that it is genuinely the best available, with the UI as the
intended successor.

### Round 1 of review on PR #1056 — three things this note got wrong

Filed here because this note was itself one of the artefacts the panel corrected. See the PR for the full
verdict; the corrections that matter to a future reader of THIS item:

1. **The tool did not work.** `promptHumanCeremony` read `process.stdin.isTTY` first, which instantiates Node's
   lazy `tty.ReadStream` on fd 0 and makes that descriptor non-blocking; the following `readFileSync(0)` threw
   `EAGAIN` into a bare `catch`, so the ceremony ALWAYS refused with an empty answer. The "verified end-to-end"
   claim above rested on two runs that were both **refusals** — and a refusal looks identical whether the gate
   works or is dead. Fixed by reading one line from `/dev/tty` with `readSync` and testing `isatty(0)` from
   `node:tty` instead of touching `process.stdin`. The prevention is
   `we:scripts/__tests__/review-clear-human-pty.test.mjs`: a pty-backed test of the SUCCESS path.
2. **"An agent structurally cannot type at a live terminal" was false**, and this note asserted it. `isatty` is
   a property of the descriptor, not of who is behind it; `script -q /dev/null` and `python3` `pty.fork()` both
   satisfy it. Corrected above, and stated once in the code rather than copied into four documents.
3. **The ceremony was an injected parameter** (`humanCeremony`) on an exported function whose return value was
   trusted verbatim, so any importer could pass `() => ({ allowed: true })` and manufacture a durable comment
   falsely asserting a human cleared the PR — strictly worse than the dead end this item set out to fix.
   Replaced with the non-injectable `allowClearHuman` boolean.

### Not addressed here

The terminal check is a practical speed bump, not a cryptographic barrier — an adversary holding the machine
wins regardless. That is the stated threat model ("an eager agent must not clear its own homework by extending
the flow it is already running"), not a gap to close with more of the same mechanism; closing it properly is the
UI-with-auth successor above.
