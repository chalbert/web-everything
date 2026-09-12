---
bornAs: xhmktct
kind: story
size: 3
parent: "3029"
status: active
scaffoldedBy: "rule3118"
dateScaffolded: "2026-08-26"
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs"]
dateOpened: "2026-08-26"
dateStarted: "2026-09-11"
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

## Probe result (2026-08-27) — `--session-id` is IGNORED

Run from `/Users/nicolasgilbert/workspace/webeverything`, CLI **2.1.246 (Claude Code)**. Command shape (the
exact argv `buildAgentArgv` emits, minus the conveyor):

```
claude --bg --session-id <minted-uuid> -n probe-3331-<i> "Reply with the single word: probe. Do nothing else."
```

Three runs. Every run printed, on stderr, before backgrounding:

```
warning: --bg manages the session id; ignoring --session-id (use --resume <id> to continue an existing session)
```

| run | minted (passed in) | listed (actual, from `claude agents --json`) | match |
|---|---|---|---|
| 1 | `c5bfcd5b-716c-4973-8c16-90424fba2064` | `45707cbb-f6dc-4600-9159-2d9ff1829674` | no |
| 2 | `a0527ec1-8cd4-4786-abb7-1c5bbe4a1ae2` | `7f4b9f11-fc7b-4b4f-9613-31e1dea36c1a` | no |
| 3 | `3ade0c8e-c34e-4733-a00d-1fd0aa841853` | `8882f9aa-5757-412d-af4c-c61db925d9e6` | no |

**3 of 3 mismatched.** The 2026-08-25 manual observation holds. `Done when` #3 is the live branch, not #2.

Two further facts read off the same listing, neither assumed beyond what was observed:

1. **`name` carries the `-n` slug verbatim** (`probe-3331-1` etc). The dispatcher already passes a slug it
   chooses (`payload.sessionSlug || 'conveyor-<num>'`, `buildAgentArgv`), so there is a dispatcher-chosen
   handle in the listing — it is the `-n` name, not the session id. Whether the slug is unique enough to key
   on is a design question for the remedy: two dispatches for the same item would collide today, since
   nothing reserves the namespace.
2. **`state` read `done` for all three finished probes.** The sink's comment at
   `we:scripts/operations/dispatch-lane-io.mjs:819-825` says `claude agents --json` carries "no terminal
   record for a completed session at all", measured on CLI 2.1.220; this run was 2.1.246, and that comment is
   now stale as written. **Do not over-read this:** `done` was only observed for sessions that finished
   normally. Whether it also covers a crashed session — the distinction the `unresolved` vocabulary exists
   for — was not probed and must not be assumed without a separate crash probe.

## Re-confirmed 2026-09-11 at CLI 2.1.269, and the COST finally measured

The probe above was run at 2.1.246 with a bare `claude --bg --session-id <uuid> -n probe …`. Re-run on
2026-09-11 at **2.1.269**, twice, this time with the **real dispatch argv** — the filled review brief,
`--append-system-prompt-file`, and `reviewDispatchDisallowedToolsArgs()`'s deny list all included, to rule out
any interaction with the review-specific flags:

| run | minted (passed in) | printed / listed (actual) | match |
|---|---|---|---|
| 1 | `37bd4e7d-6f21-4855-aa0b-82b54ebdaf4b` | `fe8b4df8` / `fe8b4df8-f682-46e4-a3a8-e7a2b772e88c` | no |
| 2 | `11111111-2222-3333-4444-555555555555` | `624b44ca` / `624b44ca-…` | no |

Same stderr warning verbatim, both runs. **5 of 5 mismatched across two CLI versions.**

**WHAT IT ACTUALLY COST, and why the bug survived a year of dispatches.** Nothing crashed and no dispatch was
lost. `claude --bg` starts the session, names it from `-n`, and it does its work: `review-2129` (dispatched
2026-09-11 under a minted id nothing in this repo could find) ran a full independent review to an `accept`
verdict and auto-cleared the label. Checked across the whole listing: `claude agents --json --all` carries
**246** `review-*`/`fix-*` sessions, and every one of `review-2115`, `review-2127`, `review-2128`,
`review-2129`, `fix-2127` is present and reached `done`.

What broke was **addressability**, three ways:
1. The dispatcher's own printed instruction — `watch it: claude agents --json | grep <sessionId>` — can never
   match. An operator who followed it saw nothing and reasonably concluded **the dispatch had silently
   failed**. That is the reported symptom this card's remedy actually fixes.
2. `stampLiveness` compares the stored handle against the listing, so **every** in-flight dispatch read
   `live: false` permanently, degrading `dispatchStillHolds`'s double-dispatch guard to its clock backstop —
   exactly the G1 failure `stampLiveness`'s own docblock says liveness exists to prevent.
3. `claude logs/attach/stop <handle>` were unusable, so a stuck dispatch could not be steered or killed by the
   id the dispatcher reported (only by hunting its `-n` name).

**Two things that are NOT affected**, checked rather than assumed:
- `we:scripts/lib/judge-spawn.mjs` and `we:scripts/operations/deliver-item-wrapper.mjs` spawn with `-p`, not
  `--bg`. **`-p` honours `--session-id`** — the warning is `--bg`-specific — so juror independence is untouched.
- `we:scripts/conveyor/reconcile-core.mjs#bindAgents` binds a review/fix session by its `-n` **name**
  (#3437/#3438), not by the dispatched id, so the re-dispatch guard for those two kinds never depended on the
  broken handle.

**Still carrying the same defect, named not fixed here:** `we:scripts/operations/explore-io.mjs#buildInvestigatorArgv`
emits `--bg --session-id` and its own `defaultClaudeProvider` returns the minted id as the panelist handle. The
report-path derivation still works (both sides use the minted id), but its liveness axis has the same permanent
`live: false`. Out of this card's scope; worth its own item.

## Remedy landed 2026-09-11 (`Done when` #3)

- `we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv` no longer emits `--session-id` on the `--bg`
  branch (the `--resume` branch is untouched).
- `we:scripts/operations/dispatch-lane-io.mjs#defaultClaudeProvider` returns the id `claude --bg` **prints**
  (`backgrounded · <id> · <name>`), read with the already-existing `parseBackgroundedId`; it falls back to the
  minted id only when stdout is unparseable, so no dispatch ever lands a null handle.
- `we:scripts/operations/dispatch-lane-io.mjs#listedSessionIds` collects the listing's short `id` alongside
  `sessionId`, which is what makes a printed handle findable. A minted uuid still matches nothing (36
  characters never equals 8).
- `we:scripts/operations/review-dispatch.mjs` and
  `we:scripts/conveyor/reconcile-fix-dispatch.mjs#dispatchFix` return and print `agentId`, the id that actually
  addresses the session.
- The sink header's *"THE HANDLE IS MINTED, NOT DISCOVERED"* paragraph and the review-dispatch header's
  *"supplying `--session-id` makes the spawned session's identity exactly that value"* paragraph are corrected
  in place, both naming what they used to claim.
- `we:scripts/operations/__tests__/helpers/fake-claude.mjs` now MODELS the real CLI: its `--bg` branch ignores
  `--session-id` and emits the warning. **This is the root cause of the test blindness** — the shim obligingly
  echoed back whatever id it was handed, so
  `we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs`'s round-trip assertion was green against an
  assumption the real CLI had never honoured.
- New regression cover: `we:scripts/operations/__tests__/dispatch-liveness-hardening.test.mjs` "hardening 6"
  (5 cases), plus `agentId` cases on the review and fix dispatch suites and the real-conflict integration test.

### A SECOND, GENUINELY SEPARATE BUG found in the same live pass — and fixed here too (#3606's missed path)

Not the same root cause, checked before concluding it: `we:scripts/conveyor/reconcile-fix-dispatch.mjs#dispatchFix`
passed **no `--append-system-prompt-file` at all** — the one dispatch path in the repo missing it.
`createDispatchSinks` has always passed `DISPATCHED_AGENT_SYSTEM_PROMPT_FILE` (so the tick-core fix dispatch was
covered) and `we:scripts/operations/review-dispatch.mjs` passes its review-side twin (#xy8di3v), but this one
passed nothing.

`we:skills-src/conveyor/fix-agent-brief.md` opens with *"**This is a TEMPLATE, not a runnable skill.**"* and
keeps `{{PLACEHOLDERS}}` / `{{LIKE_THIS}}` in its own explanatory prose — both legitimately unsubstituted,
reported by `fillBrief` as non-fatal unknown tokens by design. So a CORRECTLY filled brief still READS as an
unfilled template. **Live-confirmed 3/3 on 2026-09-11**: `fix-2127`, `fix-2130` and `fix-2003` each received a
fully substituted 16.5 KB brief naming their real PR (verified by reading their transcripts — PR #2130 appears
in the prompt; only `{{PLACEHOLDERS}}`/`{{LIKE_THIS}}` remain) and each replied *"I don't see an actual task or
question in your message — just the fix-agent brief template (#2630) itself"* and did nothing. That is exactly
#3606's `review-1998/2024/2027` failure recurring on the path the remedy was never wired into.

Fixed by passing `DISPATCHED_AGENT_SYSTEM_PROMPT_FILE` (the delivery-side file, not the review twin — a fix
agent IS a `dispatch-lane`-shaped delivery agent: it acquires a lane, works an item, pushes to a PR), with an
argv-order test. Recorded here rather than reopening the resolved #3606 because it rides this card's PR.

**Live proof, not a theory.** `defaultClaudeProvider` run against the REAL installed CLI returned handle
`f01e36ec`; `listedSessionIds(claude agents --json)` contained it on the first poll, and did NOT contain the
minted `77777777-8888-4999-a000-bbbbbbbbbbbb`. A full `we:scripts/operations/review-dispatch.mjs --pr=<N>` run
from the primary checkout printed an `agentId` that `claude agents --json` resolved to the live `review-<N>`
session.

**`#3118`'s clause-3 hinge (trigger ii): resolved.** The dispatcher CAN address the session it started — via
the printed id, not a minted one and not the listing diff the #3030 spike rejected as racy. Stop-then-resume is
therefore reachable as designed; nothing implements it yet, so this remains a dependency satisfied, not a
feature delivered.

**Superseded remedy status (`Done when` #3): started, not landed.** A build attempt produced a checkpoint commit
(`6ec8b639`) on `lane/3331-session-id-probe-salvage`, touching `we:scripts/operations/dispatch-lane-io.mjs`,
`we:scripts/operations/wake.mjs`, the sink's header comment, and a new
`we:scripts/operations/__tests__/dispatch-liveness-hardening.test.mjs`. Two agents timed out working it —
first the original build, then a continuation from the checkpoint — and neither pushed a finished,
gate-passing state. As of 2026-08-27 that branch is **53 commits behind `main`** — a plain diff against
current `main` reads as ~70 unrelated files deleted, which is drift, not intent. Whoever picks this up next
should treat the checkpoint as reference material to read, not a branch to rebase forward; re-verify from
current `main` rather than trying to carry the stale diff through 53 commits of conflict.

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
