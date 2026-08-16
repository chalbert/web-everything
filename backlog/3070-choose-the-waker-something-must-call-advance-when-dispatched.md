---
bornAs: xbu7adg
kind: decision
size: 2
parent: "3029"
status: open
dateOpened: "2026-08-11"
preparedDate: "2026-08-16"
relatedTo: ["3083"]
tags: [plateau-loop, delivery, operations, engine, dispatch]
scope:
  - we:scripts/operations/engine.mjs
---

# Choose the waker: something must call `advance` when dispatched work finishes

> **2026-08-12 (operator, in-session note, not a formal ruling):** leaning toward a dedicated `StartInterval`
> job that calls `advance` and nothing else — the converge daemon's SHAPE, not the converge daemon. Awake-only
> accepted, in the words *"For now ok if only run on awake Mac."* Recorded here as the strongest signal for the
> default below; **not** treated as ratification — this card still carries no `ratifiedBy` and no `## Ruling`,
> and only a human ratification turn can close it (see the standing rule at
> [we:docs/agent/backlog-workflow.md](../docs/agent/backlog-workflow.md): every decision item requires explicit
> human ratification, never a self-rule).
>
> **Blocked on `#3073`** at the time of that note — resolved 2026-08-12. The in-flight/dispatch vocabulary this
> decision assumes now exists in the tree (`we:scripts/operations/effect-executor.mjs`), and the waker's BODY
> that polls it has since shipped too (#3084, resolved): `we:scripts/operations/wake.mjs`. What is chosen here
> is narrower than it was when this card opened — not the shape of the pass (built), only WHAT TRIGGERS it,
> unattended.

A suspended run resumes only when someone calls `advance`, and it cannot be the session that dispatched the
work — that session is gone. The [#3030] spike named three candidates and costed none, and filed nothing.
`we:scripts/operations/wake.mjs` (#3084) is the pass a trigger would call — `wakePass`/`wakeRun`, already
built, already tested, already fail-soft per run. Until a trigger is chosen, that pass has no unattended
caller, and every run that parks on dispatched work stays parked until a person happens to run it by hand.

## Why polling is free, which narrows the decision

`advance`'s no-resume path returns the run unchanged — it is idempotent by construction, and the engine says so
in as many words. So a waker may poll as often as it likes and change nothing until the work is done. The
question is not *how to poll safely*; it is *who owns the schedule and what depends on what*.

`claude agents --json --cwd <lane>` is the poll itself: no TTY needed, filterable to one build's checkout, and
keyed on a `sessionId` that survives the process. The spike established that start and observe are both
scriptable. **Stop is not exposed** — that is a separate open question, not this one.

## Fork 1 — who owns calling `advance()` on a parked run, automatically and unattended

**Why this is a fork (real either/or), not a task:** the candidates differ in what they couple, not in
implementation effort — picking (a) is a five-line change that quietly inverts a layering the parent epic is
built on; picking (d) is more ops surface for less coupling. Exactly one of these may be the mechanism the
system RELIES ON to resume dispatched work with nobody watching — running more than one automatic owner at
once reintroduces the coupling this fork exists to avoid (see (a) and (c) below), even though calling
`advance()` itself is free and idempotent (see "Why polling is free" above). Manual invocation, (b), always
remains available as a non-relied-upon fallback no matter which option wins — it is excluded only from being
the *relied-upon* mechanism, not from existing at all.

- **(a) The drain** ([we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs), already resident, already
  sweeps every ~60s per [#event-driven-land-is-wake-only](../docs/agent/platform-decisions.md#event-driven-land-is-wake-only))
  also calls `wakePass`. **Rejected as the default, not as a possibility later** (see the opportunistic-(a)
  note below):
  it makes the operation engine's own liveness depend on the drain, the wrong direction for an epic whose
  declared end state is the drain becoming a *generated caller of* this engine
  ([#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)),
  not something the engine leans on. `we:merge-ai-prs.mjs` is also not on the epic's own list of operations
  slated to move onto this engine (`review-pr, claim, ratify, dispatch` — [#3029]), so bolting a second,
  unrelated call into a script with a documented fragile-edge history (#3053's silent re-hold, resolved but a
  reminder of how easily this file surprises) is a coupling this card should not spend on.
- **(b) An operator or agent manually re-invoking the CLI.** Free, honest, no new dependency — and not
  automatic, which fails the requirement outright. Measured, not assumed: across 2026-08-10/11 this session
  lost five headless runs that started slow dispatched work and exited before it finished, every one
  instructed against it; one left an orphaned run record with zero telemetry. A waker that depends on a
  session staying alive is a waker that stops when the session does.
- **(c) Reusing the converge daemon's PROCESS**
  ([we:scripts/converge-daemon-pass.mjs](../scripts/converge-daemon-pass.mjs), an existing `StartInterval`
  launchd job, 900s, running a PR-jury-convergence shadow pass from its own dedicated clone — installed via
  [we:scripts/converge-daemon-install.mjs](../scripts/converge-daemon-install.mjs)). Purpose-built launchd
  shape, wrong host: giving an existing single-purpose resident job a second, unrelated job (PR-jury
  convergence vs. run-advancing) is how a thin waker becomes a resident supervisor. This was also blocked
  on the silent re-hold in `we:merge-ai-prs.mjs` being understood; that is now discharged (#3053, resolved,
  `buildClearanceRevocationComment` posts unconditionally) — the exclusion stands on shape/coupling, not on
  the now-cleared blocker.
- **(d) [recommended] A new, dedicated `StartInterval` launchd job** whose `ProgramArguments` is exactly
  `node we:scripts/operations/wake.mjs` and nothing else — a SIBLING job with its own `Label`, plist and
  dedicated clone, mirroring the concrete SHAPE `we:converge-daemon-install.mjs` already validates and
  documents in its own header: `StartInterval`, never `KeepAlive` — the pass is a one-shot that exits clean,
  exactly like the converge shadow pass, so no cross-invocation supervision is needed (contrast the resident
  `KeepAlive` drain-daemon shape at
  [#drain-daemon-self-hosting-boundary](../docs/agent/platform-decisions.md#drain-daemon-self-hosting-boundary),
  which supervises a long-lived process across passes — the wrong shape here for the same reason (c) is the
  wrong host). It does **not** share the converge daemon's `Label`, plist or process.
  **Accepted cost, and it is a WASH against (a), not a cost unique to (d):** both (a) and (d) run on the
  operator's Mac, so both are awake-only — choosing (d) over (a) buys coupling direction, not uptime. A build
  finishing overnight waits for the lid to open either way. A pure `advance` tick spends no model context, so
  CI is the later home once state leaves local disk, for whichever option is running then.

**(a) as an opportunistic ADDITION, later, is not precluded.** Polling `advance()` is free, so once the drain
*is* a generated caller on this engine (the epic's own stated direction), having it also nudge the wake pass
is a legitimate config-dimension extension to revisit then — this decision does not forbid it, it only
declines to make it the relied-upon mechanism before that caller exists.

**Naming note — not a statute collision, checked directly.**
[#event-driven-land-is-wake-only](../docs/agent/platform-decisions.md#event-driven-land-is-wake-only)
(ratified 2026-07-27) governs a different system entirely: the merge-queue drain's sole-writer-to-`main`
invariant, where a webhook may "wake" that daemon sooner but must never add a second writer to `main`. This
fork creates no second writer of anything and touches a different system (an operation-engine run, not a PR
landing). No citation of it, no conflict with it — flagged only because both mechanisms live on the operator's
Mac and both use the word "wake." This card keeps calling its mechanism "the waker" (not "the wake" or "a
nudge") to keep the two apart in future search.

**Follow-up, not part of this — the concrete installer is unbuilt and unfiled.** This decision picks the
mechanism; it does not ship `we:wake-daemon-install.mjs` (the plist/clone-provisioning script
`we:converge-daemon-install.mjs` is the shape to mirror) or file the story that would. That is deliberately
out of this card's scope (`we:scripts/operations/engine.mjs` only) the same way [#3084] split the pass's
*build* from this card's *choice* — but until that install story is filed and built, the chosen mechanism
exists on paper only and a parked run still waits on a person, same as option (b) today. Whoever ratifies
this should either file that story in the same sitting or accept the gap is open.

Skeptic: SURVIVES-WITH-AMENDMENT — a hostile pass attacked five axes (fork-vs-support-both classification,
merit-ignoring-cost, the awake-only assumption, statute overlap with `#event-driven-land-is-wake-only`, and
scope-for-a-size-2-card). The recommended default (d) held on merit and on both checked statutes (neither is
cited by nor references this card; the systems are disjoint). Three amendments folded in above: (1) the
opportunistic-(a)-later option is now recorded explicitly rather than silently foreclosed; (2) the
accepted-cost bullet now states plainly that awake-only is a wash against (a), not a real differentiator, so
it cannot be misread as a reliability trade; (3) the vocabulary note above disambiguates "the waker" from the
land statute's "wake"/"nudge." The skeptic's fifth finding — no install story is filed yet — is recorded as the
Follow-up above rather than silently absorbed into "done."

Screen: clear — fresh-context pass confirmed the fork is invisible to any WE/FUI API or console consumer (no
caller across that boundary ever observes which local process triggers `advance()`), but it carries a genuine
intra-repo architectural concern (dependency direction between the operation engine and the drain, relative to
the epic's own declared end state) that survives even under a "free to build and maintain" hypothetical for
all four options — the case for (d) over (a) is explicitly a direction argument, not a cost argument, and the
text says so in its own accepted-cost bullet.

## Done when

- [x] One waker is chosen, with the dependency it creates stated rather than discovered later — Fork 1 (d).
- [x] The rejected options record WHY, so the next reader does not re-open a settled trade — Fork 1 (a)-(c).
- [x] If the choice is blocked on other work, that blocker is named and linked — was #3073, resolved
      2026-08-12; no remaining blocker on the choice itself. The Follow-up above names the next, separate gap
      (an unfiled install story), which does not block ratifying this fork.
