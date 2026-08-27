---
bornAs: xhmktct
kind: story
size: 3
parent: "3029"
status: open
scaffoldedBy: "rule3118"
dateScaffolded: "2026-08-26"
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/wake.mjs", "we:scripts/operations/__tests__/"]
scopeRationale: "Widened at build time from the two files first filed, and the widening is forced by the answer rather than chosen. `assertHandleNotLive` in we:scripts/operations/wake.mjs compares a dispatch handle against the SAME listing this card re-keys; leaving it on the old id-only compare would have made `wake --resolve` close out live agents — a safety regression introduced BY the fix, so it is in scope by necessity. The tests directory is directory-level because the handle's shape is asserted in five test files plus the fake-CLI helper under we:scripts/operations/__tests__/helpers/, and a per-file list would have missed one. we:scripts/operations/explore-io.mjs is deliberately NOT in scope — it carries the identical defect and #3356 owns it."
dateOpened: "2026-08-26"
relatedTo: ["3118", "3096", "3037"]
tags: [plateau-loop, delivery, operations, conveyor, dispatch, probe]
---

# PROBE: does `claude --bg` honour `--session-id`? dispatch-lane's observer may never match a live session

`we:scripts/operations/dispatch-lane-io.mjs` **mints** the session id it dispatches with, then later looks
for that same id in `claude agents --json` to decide whether the agent is still running. One manual
observation on 2026-08-25 suggested `claude --bg` **ignores** `--session-id`. If that holds, the comparison
can never match, and the conveyor cannot see its own agents — **nor address them by id, which is what
`#3118`'s ratified stop-then-resume steering presupposes.** Two things ride on this probe, not one.

**One manual run is not evidence.** This card's first job is a probe that settles it. Nothing here should be
fixed before the probe answers, and the probe's answer is the deliverable even if it says the assumption is
fine.

## The mechanism, line by line

All line numbers are against `main` at `3b2aeded`. Every line below was read, not recalled.

1. **The sink mints the handle.** `createDispatchSinks` does
   `const sessionId = String(mintSessionId());` — `we:scripts/operations/dispatch-lane-io.mjs:558` — and hands
   it to `buildAgentArgv` at `:559`.
2. **The argv pins it.** `buildAgentArgv` emits `'--session-id', String(sessionId)` —
   `we:scripts/operations/dispatch-lane-io.mjs:621` — immediately after `'--bg'` at `:620`.
3. **The observer matches on that minted value.** `createDispatchObservers` reads the handle back off the run
   entry — `const handle = String(ctx?.handle ?? entry?.handle ?? '');`,
   `we:scripts/operations/dispatch-lane-io.mjs:693` — and then does
   `const live = sessions.find((s) => s && String(s.sessionId) === handle);` at `:738`.
4. **The sink says the mint is load-bearing, in as many words.**
   `we:scripts/operations/dispatch-lane-io.mjs:509-514`: *"THE HANDLE IS MINTED, NOT DISCOVERED, and that is
   the load-bearing detail… `claude --session-id <uuid>` removes the race outright: the dispatcher CHOOSES
   the id, so the handle is known before the agent exists and cannot be attributed to the wrong session."*

## What breaks if the observation holds

If the real CLI discards `--session-id` on a `--bg` spawn, the session the sink started is listed under a
**different** id, so `:738` never matches. The observer then falls through:

- Not-yet-listed grace — `we:scripts/operations/dispatch-lane-io.mjs:744` — holds it as `running` for
  `LISTING_GRACE_MS` (`:67`), which derives from `DISPATCH_LISTING_GRACE_MINUTES = 2`
  (`we:scripts/operations/dispatch-lane.mjs:111`).
- After those two minutes it returns `status: 'unresolved'` with *"session … is no longer listed by
  `claude agents`"* — `we:scripts/operations/dispatch-lane-io.mjs:747-752`.

**Scope the damage honestly — the liveness axis is not the only axis.** The observer tries the **PR axis
first** (`we:scripts/operations/dispatch-lane-io.mjs:695-729`); a merged PR still returns `succeeded` at
`:716-724` regardless of the session id. So the failure is not "nothing ever resolves". It is narrower and
still serious: the liveness axis is, by its own comment at `:731-732`, *"what answers while no PR exists
yet, which is every dispatch for most of its life"*. A dispatch would read `unresolved` for its entire
pre-PR life, two minutes after it starts.

## Why one manual run does not settle it, and no existing test does either

- **No test in this repo starts a real `claude`.** The nearest,
  `we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs`, spawns a **fake** `claude` placed first on
  `PATH` (`withFakeClaude`, its `:31`) and asserts the argv is accepted and that the id pinned here is the id
  the fake reports back (`:68`). That proves the argv shape and the round-trip through a stand-in, not the
  real CLI's behaviour.
- **`we:scripts/operations/__tests__/dispatch-lane.test.mjs:645`** — *"pins the handle with `--session-id`
  instead of racing to discover it"* — asserts the argv and nothing about the CLI's response to it.
- **The sink already concedes this.** `we:scripts/operations/dispatch-lane-io.mjs:528-534`: *"PROVEN AGAINST
  A PROCESS, NOT AGAINST THE REAL CLI… What is still NOT proven: no dispatch has been fired end to end, and
  the REAL CLI's response to this argv remains unasserted."* It names `#3096` — which is `#3096` — as
  where a first live run happens.

## THE PROBE HAS RUN. `claude --bg` IGNORES `--session-id`.

Run **2026-08-27** from the primary checkout, CLI **2.1.246 (Claude Code)**. Three runs, no conveyor, no lane
and no brief — a bare spawn in the argv shape `buildAgentArgv` emits:

```
claude --bg --session-id <minted-uuid> -n probe-3331-<i> "Reply with the single word: probe. Do nothing else."
```

Spawn exit **0** each time. Every run printed this on stderr before backgrounding:

```
warning: --bg manages the session id; ignoring --session-id (use --resume <id> to continue an existing session)
```

### Minted vs listed, from `claude agents --json`

| `-n` slug | minted (passed to `--session-id`) | listed (what the CLI actually used) | match |
|---|---|---|---|
| `probe-3331-1` | `c5bfcd5b-716c-4973-8c16-90424fba2064` | `45707cbb-f6dc-4600-9159-2d9ff1829674` | **no** |
| `probe-3331-2` | `a0527ec1-8cd4-4786-abb7-1c5bbe4a1ae2` | `7f4b9f11-fc7b-4b4f-9613-31e1dea36c1a` | **no** |
| `probe-3331-3` | `3ade0c8e-c34e-4733-a00d-1fd0aa841853` | `8882f9aa-5757-412d-af4c-c61db925d9e6` | **no** |

**3 of 3 mismatched**, and the CLI says why itself. The 2026-08-25 manual observation holds. `Done when` **#3**
is the live branch; **#2 does not apply and was not built.**

**The narrow claim, not the wide one.** The warning is specific to `--bg`. `we:scripts/lib/judge-spawn.mjs`
pins a juror's id with the same flag on a **headless** (`-p`) spawn, and nothing here touches that. Only the
backgrounded spawn discards it.

### Two further facts from the same listing, neither assumed

1. **`name` carries the `-n` slug verbatim.** Row keys were
   `['cwd', 'id', 'kind', 'name', 'sessionId', 'startedAt', 'state']`, and `name` read `probe-3331-1` and
   siblings. So a dispatcher-CHOSEN value does survive into the listing — it is the `-n` name, not the session
   id. That is what the build is now keyed on; see the design call below.
2. **A `state` field exists and read `done` for all three finished probes.** The observer's comment claiming
   `claude agents --json` carries "no terminal record for a completed session at all" was measured on
   **2.1.220** and is stale as written; it has been corrected. **Nothing is built on `state`, deliberately.**
   `done` was observed only for sessions that finished NORMALLY. Whether a **crashed** session also reads
   `done` was **not probed** — and that is exactly the distinction the `unresolved` vocabulary exists to keep.
   Building on `state` without probing a crash would reintroduce the *terminal ≠ succeeded* conflation the PR
   axis was written to refuse. Probe a crash first; until then this is recorded as unprobed, not as unavailable.

## What was built (`Done when` #3)

**THE DESIGN CALL: the handle is still MINTED, and it now rides `-n` instead of `--session-id`.** The #3030
property this design rests on — the dispatcher CHOOSES the handle, so it is known before the session exists
and can never be attributed to whatever else started in the same instant — is intact. Only the carrier moved,
from a flag the CLI discards to one it echoes back verbatim.

**The slug alone would NOT have done, and the repo's own fixture proves it.** `payload.sessionSlug ||
'conveyor-<num>'` is per-ITEM, not per-ATTEMPT, and re-dispatch is a designed path (the executor keeps
`supersededHandles` precisely because a retry mints a fresh handle while the old one may still be alive).
`we:scripts/operations/__fixtures__/claude-agents-payload.json` is a REAL 14-row listing off this machine and
carries **`conveyor-3154` three times** and `conveyor-3151` twice. Matching on the bare slug would have
attached the observer to the wrong dispatch. So:

- `mintDispatchHandle` mints `<sessionSlug>-<8-char token>` — unique per ATTEMPT, still legible in
  `claude agents` because the slug is still the front of it.
- `findListedSession` is the ONE matcher every reader goes through, and **more than one match is not a match**:
  the count rides the answer and every caller fails closed on it. The observer throws, the double-dispatch
  guard degrades to its clock backstop, and `wake --resolve` refuses. A wrong match would report a live
  agent's status for a different dispatch, which is worse than no match because it is indistinguishable from a
  right one.
- `--session-id` is no longer emitted at all. Emitting a flag whose only effect is a warning line kept telling
  the next reader that the handle is a session id — the belief that made the liveness axis unmatchable.
- The handle is **not** the lane-lease session. The brief's `SESSION_SLUG` is unchanged, so
  `we:scripts/conveyor/lease-reaper.mjs`'s `itemNumFromSession` grammar is untouched; the new handle is anchored OUT of that grammar
  and yields no key rather than a wrong one (the #3283 failure mode, checked rather than assumed).
- `persistDiscoveredSessionId` writes the REAL id off the matched listing row onto the in-flight entry, on
  both read paths (the observer and the tick read's liveness stamp). It never overwrites a differing id.

**What is honestly narrow about it.** The `-n` round trip was measured on 2.1.246 for three sessions; no
length or charset limit on `-n` was probed, and the handles this mints are ~22 characters where the CLI's own
auto-names are ~16. Uniqueness is bought by an 8-character token, so a genuine collision is possible and
degrades to a REFUSAL rather than a wrong match — that is the whole reason the count rides the answer.

## What this means for `#3118` (the answer this card owed)

**Yes — the dispatcher can now address the session it started, but only after one observation, not at spawn.**

Clause 3 of
[#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation)
accepts **stop-then-resume** as the conveyor's steering mechanism, and `claude --resume <sessionId>` addresses
a session by ID. Before this card that id existed nowhere: the sink minted one the CLI threw away, so the
ruling's load-bearing acceptance rested on a fact that was false. It is now true with one caveat that matters
for anyone building steering:

- **At spawn time the id is UNKNOWN.** `claude --bg` returns having printed only a short id to stderr, and
  nothing parses that. The entry carries the handle it can prove and no `sessionId`.
- **After the first listing read that matches the handle, the id is on the run entry** (`entry.sessionId`), and
  a resume can address it. In practice that is one waker pass — seconds to a couple of minutes.
- **So a steering implementation must handle "not yet addressable".** An agent that crashes or is stopped
  before any observation leaves an entry with a handle and no id; it can be found in a listing while alive, and
  cannot be resumed after. That window is real and small, and it is the honest residual.

**Revisit trigger (ii) fired, and the remedy it names is what this card built — so the clause stands.** Stating
it as "the trigger does not fire" would be wrong: the trigger's antecedent is *"if `#3331`'s probe comes back
negative"*, and it did. What the clause itself says next is that stop-then-resume is unreachable *"until
`#3331`'s own remedy (reading the real id back off `claude agents --json`) exists"* — and it now does. The
antecedent was met and the exception was satisfied in the same change, so nothing in the ruling needs
reopening on this axis.

**Two lines of clause 3 are now stale as written, and this card deliberately does not edit them.**
[#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation)
still reads *"reaching the mechanism is UNVERIFIED"* and *"trigger (ii) is live today"*. Both were true when
written and are not now. `we:docs/agent/platform-decisions.md` is ratified statute; amending it is an operator's
ratification act, not a build's, so this card reports the fact and leaves the edit to whoever holds that pen.

Steering itself remains unimplemented, and the card's own grep needs restating rather than repeating.
`grep -rnE -- '--resume|resumeAgent|steer'` over `we:scripts/operations/dispatch-lane-io.mjs`,
`we:scripts/operations/dispatch-lane.mjs` and `we:scripts/conveyor/tick-core.mjs` no longer returns nothing —
it returns **five hits, all of them DOCBLOCK prose in this change**, explaining what the stored id is for.
There is still no call site: nothing spawns `--resume`, and no function resumes or steers an agent. That is a
dependency, not a defect — but a later reader running the same grep should know why it is no longer empty.

## Done when

1. **The probe has run and its result is written into this card**, with the exact command, the CLI version,
   the id passed, and the id `claude agents --json` reported back. Repeated at least three times, since a
   single run is what got us here. Either answer closes the probe.
2. **If `--session-id` is honoured**: a test defends it so this cannot silently regress, and the sink's
   `:528-534` "NOT PROVEN" comment is updated to say what is now proven.
3. **If it is ignored**: the observer stops matching on a minted id — it reads the real id back from the
   listing and stores it on the run entry — and a test covers the case where the listed id differs from the
   dispatched one. The sink's `:509-514` header is corrected in the same change, because it currently states
   the discarded assumption as the design's load-bearing detail. **The real id this step recovers is also
   what any future `claude --resume` would have to address** — see the steering dependency below.

## The `#3118` ruling's hinge depends on this card's answer

Not only the observer rests on the minted handle. `#3118`'s ruling accepts **stop-then-resume** as the
conveyor's steering mechanism, and clause 3 of
[#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation)
carries that acceptance into statute. `claude --resume <sessionId>` addresses a session **by its id**, so
the dispatcher can only resume an agent whose id it knows — the same presupposition this card is probing.
The two rows of the 2026-08-25 manual run are therefore **coupled, not independent**: the row that says
context survives a resume is only reachable if the row that says `--session-id` is ignored turns out false,
or if this card's `Done when` #3 remedy is built.

Nothing implements steering yet, so nothing is broken today — it is a dependency, not a defect.
`grep -rnE -- '--resume|resumeAgent|steer'` over `we:scripts/operations/dispatch-lane-io.mjs`,
`we:scripts/operations/dispatch-lane.mjs` and `we:scripts/conveyor/tick-core.mjs` returns **nothing**
(re-run 2026-08-26). What this card owes `#3118` is therefore small and concrete: when the probe answers,
say in the answer **whether the dispatcher ends up able to address the session it started**, because that
is the fact clause 3's revisit trigger (ii) fires on.

## Lineage

Filed 2026-08-26 as a named, non-waived cost of the `#3118` ruling
([#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation)),
which routes the conveyor's dispatch through this operation and therefore inherits this assumption.
**This card also owns the `#3118` ruling's hinge** — clause 3's stop-then-resume steering presupposes the
dispatcher can address the session by its id, which is the very question probed here; see the section above.
*(Added 2026-08-26 on the PR #1583 review. As first filed, this card was scoped to the observer alone, which
under-stated it: the ruling's load-bearing acceptance rested on the same unproven fact and had no owner.)*
**Overlaps `#3096` deliberately, and does not duplicate it:** `#3096` owns the first end-to-end live dispatch
and what a background session's permission mode and isolation default must be. This card owns one narrower
question — whether the handle the observer compares against is the handle the CLI actually uses — which can
be answered by a bare `claude --bg` spawn with no conveyor, no lane and no brief. Run it first; it may change
what `#3096` has to build.
