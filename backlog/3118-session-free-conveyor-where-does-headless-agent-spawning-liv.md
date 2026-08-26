---
bornAs: x501fk9
kind: decision
parent: "2753"
status: resolved
dateOpened: "2026-08-15"
dateResolved: "2026-08-26"
codifiedIn: "docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation"
ratifiedBy: "Nicolas Gilbert (operator)"
preparedDate: "2026-08-25"
relatedReport: reports/2026-07-12-claude-cli-agent-runner-headless-contract.md
relatedTo: ["2464", "2530", "2444", "2703", "3102", "3031"]
tags: [plateau-loop, conveyor, agent-runner, session-free]
---

# Session-free conveyor: where does headless agent-spawning live -- WE-native runner vs a cross-process call into plateau-app's build-runner

> **RULED 2026-08-26 by the operator (Nicolas Gilbert): Fork 1 → (c), call the existing `dispatch-lane`
> operation.** The ruling and its full reasoning are in **[THE CALL](#the-call-operator-2026-08-26-fork-1--c-call-the-existing-dispatch-lane-operation)**
> near the end of this card. That section is the only operative statement of the decision — everything above
> it is the record of how the card got there, including two amendments that were retracted rather than
> deleted. Codified as
> [#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation).

**Filed while preparing #2464 (now resolved into this item — see below).** The #2444-ratified CLI-spawn
agent-runner contract (`spawn`/`steer`/`stop`/`resume`/`observe`) already shipped in code at
`plateau-app:src/build-runner/runner.ts` (#2530, merged 2026-07-16, independently reviewed —
`plateau-app` commit `44dfc8b`) — but only as the engine behind `POST /api/backlog/build`, a per-click,
human-confirmed, single-item builder living inside `plateau-app`'s dev server
(`plateau-app:src/build-runner/build-action.ts`).

The conveyor's headless runner (`we:skills-src/conveyor/runner.mjs`, #2702) still can't spawn agents
itself. Per its own doc, `we:skills-src/conveyor/SKILL.md` (the "interim bridge" section): *"the runner
spends no model context, so it surfaces (never spawns) the delivery / prepare / fix / CI-heal agents...
Spawning an LLM agent needs a harness; the backend-agnostic CLI agent-runner that would let the runner
spawn them itself, headlessly, is a separate, later slice."* A live main session reads the runner's
surfaced dispatch (`spawnBuilds` / `spawnPrepareScope` / `spawnPrepareDecision` / `spawnFixes` /
`spawnCiHeals`) and executes the spawns on demand. #2753 and #3102 both name closing this gap **"the
critical path to zero-session delivery"** — the one item standing between today's session-supervised
conveyor and a fully headless one.

**Grounding (`/prepare`, 2026-08-16).** No design exists greenfield here — this is not a new web-aligned
standard, so no new `/research/` topic was published; it composes two pieces of *already-published*
research/ruling instead: the CLI-spawn contract's own survey
([/research/claude-cli-agent-runner-headless-contract/](/research/claude-cli-agent-runner-headless-contract/),
`relatedReport` above) and a concrete read of both candidate code paths (`plateau-app:src/build-runner/`,
`we:skills-src/conveyor/runner.mjs`, `we:skills-src/conveyor/SKILL.md`). Prep also surfaced one load-bearing
piece of NEW context the original filing didn't have: `we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated`
(#3031), ratified 2026-08-08 — three weeks after #2701 and one week before this item was filed — which rules
on close-to-the-same architectural question for a sibling system and explicitly names this item's own
context (#2701/#2703) in its reconciliation footnote. See Fork 1's `Skeptic:`/`Screen:` lines for how that
finding was weighed (folded in as strong supporting precedent, not treated as dispositive on its own —
prep does not self-rule this item; see the fork below for the still-open call).

## Axis

One axis, one fork: **where the code that spawns a supervised `claude` CLI child for the conveyor's five
dispatch kinds (`build` / `prepare-scope` / `prepare-decision` / `fix` / `CI-heal`) lives**, pinned to:
`plateau-app:src/build-runner/runner.ts:55-232` (class `AgentRunner`, the shipped #2530 implementation),
`we:skills-src/conveyor/runner.mjs:81-95` (`tickSurface()`, the five-kind dispatch shape the conveyor
already emits), and `we:skills-src/conveyor/SKILL.md:29-41` (the "interim bridge" the fork retires).

## Recommended path at a glance

| Fork | The call | Default | Main alternatives (excluded) | Confidence |
|---|---|---|---|---|
| 1 | Where the agent-spawn backend lives | **(c) call the existing `dispatch-lane` operation** — the declared operation that already starts agents headlessly; the runner calls it per surfaced dispatch | (a) port a new WE-native `we:scripts/conveyor/agent-runner.mjs`; (b) cross-process HTTP into `plateau-app` | medium-high |

> **AMENDED 2026-08-25 — the fork survey was missing an option, and it changes the default.** The original
> preparation (2026-08-16) framed this as a two-way choice between porting a runner and calling `plateau-app`
> over HTTP. It never surveyed `we:scripts/operations/dispatch-lane.mjs`, whose sink header states *"THE SINK
> IS THE ONLY THING IN THIS REPO THAT STARTS AN AGENT"* and which spawns via `claude --bg` today.
>
> This is **not** a staleness correction: `dispatch-lane` landed **2026-08-13** (`WE #3037: declare dispatch
> — the effect that starts rather than completes`), three days *before* this card was prepared. The survey
> simply missed it. Recorded rather than quietly repaired, per
> `we:agent-memory-src/grep-every-name-you-cite-in-prose.md`.
>
> The original (a)-vs-(b) **analysis** below is kept intact and still holds — every argument it makes against
> (b) applies unchanged. What changes is that (a) is no longer the best of the remaining options.
>
> **That disclaimer covers the analysis and nothing else.** The first two cuts of this amendment let it cover
> the card's *operative* passages too, and for two review rounds this card named **two defaults** — the table
> above said (c) while the option-(a) bullet, the recommendation line, the `codifiedIn` sentence and the
> pre-registered jury's touch-set all still said (a). Corrected 2026-08-25 (PR #1565 round 2, finding F2):
> each of those four now carries its own quoted retraction in place. A recommendation, a ratification text and
> a jury binding are not analysis. Prevention filed: **#3281** (a `check:standards` rule counting default
> markers per fork).

## Fork 1 — where the agent-spawn backend lives

*Fork exists:* the two branches genuinely cannot both be the conveyor's canonical dispatch path — a
"support-both" reading (build the WE-native runner *and* keep an HTTP fallback into `plateau-app`) would
mean two live spawn implementations behind the same five-verb contract with independent failure modes,
which is exactly the second-implementation shape [#deterministic-core-thin-judgment](/docs/agent/platform-decisions.md#deterministic-core-thin-judgment)'s
one-source clause forbids; only one can be *the* path the runner calls.

- **(a) WE-native runner.** Port the ratified contract into a new `we:scripts/conveyor/agent-runner.mjs` —
  a plain Node module, no framework dependency (verified: the four `plateau-app:src/build-runner/` source
  files import nothing but `node:child_process`/`node:fs`/`node:os`/`node:path` — zero React/Next imports),
  a near-mechanical TS→mjs port of the same `spawn(task)`/`steer(text)`/`stop()`/`resume(text)`/`redirect(text)`/`observe()`
  ops. Wired directly into `we:skills-src/conveyor/runner.mjs`'s existing dispatch surface (`tickSurface()`,
  `we:skills-src/conveyor/runner.mjs:81-95`, which already emits `{ builds, prepareScope, prepareDecision, fixes, ciHeals }`)
  so the headless runner spawns agents itself, in-process, for **all five** dispatch kinds. No runtime
  dependency on `plateau-app`'s dev server being up. **SUPERSEDED DEFAULT (was the default until the
  2026-08-25 amendment; displaced by (c) — see below).**
- **(b) Cross-process call into `plateau-app`.** The conveyor's runner calls `plateau-app`'s existing
  `POST /api/backlog/build` (or new sibling endpoints for the other four kinds) over HTTP, reusing #2530's
  shipped code instead of porting it. *Rejected* — see Skeptic below.
- **(c) Call the existing `dispatch-lane` operation.** *(Added 2026-08-25 — see the amendment note above.)*
  The runner calls `we:scripts/operations/dispatch-lane.mjs` once per surfaced dispatch. Nothing is ported
  and nothing is spawned in-process: the operation already starts a real detached agent via `claude --bg`,
  already reads the tick core, already fills the brief, already writes a run record, and is already pollable
  by `claude agents --json` and resumable by the waker. **NEW DEFAULT.**

**Why (c) displaces (a) — the card's own principles, applied to an option it did not survey:**

1. **(a) creates the second implementation this fork's own opening paragraph forbids.** That paragraph
   rejects supporting two branches because it *"would mean two live spawn implementations behind the same
   five-verb contract with independent failure modes, which is exactly the second-implementation shape
   [#deterministic-core-thin-judgment]'s one-source clause forbids."* A new
   `we:scripts/conveyor/agent-runner.mjs` sitting beside `dispatch-lane`'s existing `claude --bg` spawn **is
   that shape** — the argument was aimed at (b) and lands just as hard on (a).
2. **#3031 points at the declared operation, not away from it.** The card leans on
   `we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated` to justify a WE-native
   port. But that statute's actual content — declare an operation once, generate its callers — argues for
   the runner becoming another *caller* of `dispatch-lane`, not for a second spawn path outside the
   operations engine entirely.
3. **The precedent cited for (a) is satisfied by (c) too.** The card's "local process, not HTTP" precedent
   (`plateau-app` shelling `we:scripts/lane-pool.mjs` rather than calling over the network) is about
   spawning a local child process. `dispatch-lane` *is* a local child process spawn. (c) keeps the precedent
   and adds no new module.
4. **Coverage is the same problem for both. Most of it is filed; the rest is not.** (a)'s advantage over (b)
   was that it covers all five dispatch kinds — `we:scripts/conveyor/tick-core.mjs:856-861` returns
   `spawnBuilds`, `spawnPrepareScope`, `spawnPrepareDecision`, `spawnFixes`, `spawnCiHeals`.
   `dispatch-lane` covers **builds only** today (`we:scripts/operations/dispatch-lane-io.mjs:139` launches
   `match(decisions.spawnBuilds)`; `briefPath` at `:52` takes no `kind`). **#3165** closes **three of the
   five** — its design, tasks and "Done when" cover `build` + `prepare-scope` + `prepare-decision`, and
   `spawnFixes` / `spawnCiHeals` appear nowhere in that card (grepped: zero occurrences). It is a smaller
   change than porting a runner — give the brief selector and the session slug a `kind`, and launch all three
   planned lists. **The remaining two kinds (`fix`, `CI-heal`) are not filed anywhere**, and closing them is a
   cost of (c) that no card carries yet.

   **RETRACTED 2026-08-25 (PR #1565 review round 2, driver finding F4).** This point previously ended:

   > *"That gap is **#3165**, already prepared, and it is a smaller change than porting a runner: give the
   > brief selector and the session slug a `kind`, launch all three planned lists, and answer the one open
   > question of what an unscoped prepare declares as its scope."*

   Two things were **wrong**. It called the five-kind gap "#3165" and then, in the same sentence, described
   #3165 as launching *"all **three** planned lists"* — so it contradicted itself and overstated the coverage
   #3165 buys. And there is no *"one open question"* left: `#3165` in this very tree says at `:85` *"There is
   nothing to research"*, at `:87` *"the lane scope is already decided, shipped, and running — it is not this
   card's to choose"*, at `:97` *"Recorded as the existing ruling, not as a pick"*, and at `:99` records that
   *"an earlier round replaced a false confident claim with a manufactured open question."* That round-3
   correction (`3f27271f`) is an ancestor of this branch's head — this card was re-asserting the manufactured
   question one file away from the card that retracts it.

**What (c) costs, stated rather than hidden.** Three things, where (a) depends on nothing:

1. It makes this decision depend on #3165 landing first — which buys three of the five dispatch kinds
   (`build`, `prepare-scope`, `prepare-decision`), not all five. *(This line previously read "the five-kind
   coverage gap above", which was **wrong** — #3165 is a three-kind card. See the F4 retraction in point 4.)*
2. The other two kinds — `spawnFixes` and `spawnCiHeals` — have **no card at all**. Filing and building that
   coverage is (c)'s cost, and it is the part of (a)'s five-kind advantage that survives the amendment.
3. It inherits `dispatch-lane`'s **unproven handle assumption** — and, if the measurement recorded below
   holds, an open defect in the observer that has to be closed before the conveyor can trust it. See the
   retraction under the probe table; this cost was **wrongly described as already-handled** in the first cut
   of this amendment.

**The steer question this fork turned on has been PROBED, and it does not decide the fork.** An earlier
version of this section said (c) inherits the `claude --bg` backend rather than the ratified five-verb
`spawn`/`steer`/`stop`/`resume`/`observe` contract, so *"`steer` and `redirect` are not available through
it"*, and made mid-flight steering the pivot: if the conveyor needs to steer, (a)'s richer contract earns its
second implementation.

Measured 2026-08-25 rather than reasoned about — a detached `--bg` agent, stopped, then resumed:

| step | result |
| --- | --- |
| spawn detached, stop the session | — |
| `claude --resume <sessionId>` with new instructions | the agent answered with the sentinel planted before the stop — **context preserved** |
| `--session-id` on a `--bg` spawn | **ignored** in this one manual run — no test defends it either way. If it holds, reading the real id back from `claude agents --json` is work that **does not exist yet** (see the retraction below) |

So steering IS reachable through the `--bg` backend — as stop-then-resume rather than as a `steer(text)`
write to a live stdin. That is a coarser verb, not a missing capability, and it costs one extra round trip
per steer. Two consequences for this fork:

> **NARROWED 2026-08-26 (PR #1583 review).** *"Steering IS reachable"* is the **mechanism** being reachable,
> not the conveyor being able to reach it. The third row of the same table is a **precondition** of the
> second, and this paragraph originally read as though the two rows were independent findings, which was
> **wrong**: `claude --resume` takes a session **id**, so if `--bg` discards `--session-id` the dispatcher has
> no id to resume with. Read row 2 as *"resume preserves context once you can address the session"* — and row
> 3 as the open question of whether it can. `#3331` owns it; see the correction under
> [THE CALL](#the-call-operator-2026-08-26-fork-1--c-call-the-existing-dispatch-lane-operation)'s reason 2.
> The two consequences below still hold, but with the dependency named. Unlike (c), **(a) would not need
> id-addressing at all** — it holds the live child in-process, so its `steer(text)` is a write to that child's
> stdin (see (a) above). So a negative probe does not restore (a)'s *capability* advantage — `#3331`'s
> `Done when` #3 is a remedy, not a rebuild — but it does add a prerequisite to (c) that (a) does not carry,
> which is why clause 3 revisits on it.

1. **The pivot is gone.** "Does the conveyor need to steer?" no longer separates (a) from (c), because both
   can. What separates them is whether the conveyor needs to steer a *running* agent **without interrupting
   it** — and nothing in `we:scripts/conveyor/tick-core.mjs` plans anything of the kind. Its decisions are
   spawn, watch, retire.
2. **The remaining cost of (c) is latency and granularity, not capability**, which is a much weaker reason to
   stand up a second agent-spawning implementation.

**RETRACTED 2026-08-25 (PR #1565 review, `correctness` lens).** The first cut of this paragraph said, in
full:

> *"The second row is a live constraint on (c) regardless of the fork: a dispatcher that pins a session id
> and expects the background process to honour it is pinning a value the CLI discards, so the handle must be
> recovered from the listing. `we:scripts/operations/dispatch-lane-io.mjs`'s observer is where that lives."*

The last sentence was **wrong**, and wrong in the direction that under-scopes the work: it read as
*dispatch-lane already recovers the handle*, and nothing there does. The observer never re-derives an id
from the listing. It compares against the very id the sink minted:

- `createDispatchSinks` mints the handle itself — `const sessionId = String(mintSessionId())`
  (`we:scripts/operations/dispatch-lane-io.mjs:555`) — and passes it to `buildAgentArgv`, which emits
  `'--session-id', String(sessionId)` (`:618`).
- `createDispatchObservers` then does `sessions.find((s) => s && String(s.sessionId) === handle)`
  (`:735`), where `handle` is that same minted value read back off the run entry (`:690`).
- The sink's own header says so in as many words: *"THE HANDLE IS MINTED, NOT DISCOVERED... the dispatcher
  CHOOSES the id"* (`:507-514`).

**The correction, and it is a finding rather than a wording fix.** If the measured row above holds — if
`claude --bg` ignores `--session-id` — then that comparison at `:735` can never match a live session, and
`dispatch-lane`'s observer reports every real dispatch as `unresolved` ("no longer listed") the moment the
`LISTING_GRACE_MS` window (`:67`) closes. That is not a constraint (c) inherits already-handled; it is an
open defect in the operation (c) proposes to call, and closing it is part of (c)'s cost alongside #3165.

**How strongly the measurement is held.** Weakly, and it should stay that way until something defends it.
No test in this repo starts a real `claude` process. The nearest one,
`we:scripts/operations/__tests__/dispatch-lane.test.mjs:645` (*"pins the handle with --session-id instead of
racing to discover it"*), asserts the **argv shape** and nothing about the CLI's response to it, and the
sink's own comment concedes the path is *"NOT YET PROVEN LIVE... the argv below is asserted, the CLI's
response to it is not"* (`:528`). So the honest reading of the row is: a one-off manual observation that
**contradicts an assumption dispatch-lane is built on**, which makes settling it — a live end-to-end
dispatch, per the `#3096` pointer the same comment gives — a prerequisite of routing the conveyor
through (c), not a detail to note in passing.

*Prevention for the generator, filed rather than promised:* **#3280** — every name in the retracted
sentence grepped clean, so the existing name-resolution discipline could not have caught it. The clause it
adds to the `correctness` lens is that an "already handles this" claim must line-cite the code doing the
handling.

```js
// Fork 1 (a) — we:scripts/conveyor/agent-runner.mjs, a near-mechanical port of
// plateau-app's build-runner/runner.ts (strip TS types, keep the same shape):
export class AgentRunner {
  spawn(task) { /* same argv shape as the source: -p, --output-format stream-json, --input-format stream-json */ }
  steer(text) { this.#proc?.stdin?.write(JSON.stringify({ type: 'user', message: { role: 'user', content: text } }) + '\n'); }
  stop(graceMs = GRACE_MS) { /* graceful — close stdin, escalate to SIGTERM on timeout */ }
}

// we:skills-src/conveyor/runner.mjs — the tick loop spawns IN-PROCESS off tickSurface():
const surface = tickSurface(out);
for (const b of surface.dispatch.builds) agentRunner.spawn(buildTaskFor(b));       // was: surfaced to a human session
for (const f of surface.dispatch.fixes) agentRunner.spawn(fixTaskFor(f));         // all 5 kinds, same backend
```
```js
// Fork 1 (b) — contrast: the conveyor's runner calls OUT to plateau-app's dev server instead of spawning locally
const res = await fetch(`http://localhost:${PLATEAU_PORT}/api/backlog/build`, { method: 'POST' });
// only 'build' has an endpoint; prepare-scope/prepare-decision/fix/ci-heal have none — and PLATEAU_PORT
// is ambiguous the moment more than one lane clone's dev server could answer (no per-clone routing today).
```

**Known occurrences (in-repo precedent for "local process, not HTTP").** `plateau-app:src/build-runner/build-action.ts`
(around lines 236-247 and 307) already has this exact cross-repo problem — one build run needs to
acquire/release a lane clone that lives in the *web-everything* checkout — and it does **not** reach across
via HTTP even though `plateau-app` already has a live dev server: it shells `node we:scripts/lane-pool.mjs
acquire|release` in the WE checkout via `execFile` (a local child process, no network hop, no port to
guess). The established in-repo pattern for cross-repo delivery-loop coordination in this codebase is
already "spawn/shell a local process," not "call a service" — (a) extends that same pattern to the
conveyor's own need, (b) would introduce the first instance of the opposite pattern into the critical
delivery path.

**Recommended default: (c) — call the existing `dispatch-lane` operation.**

**RETRACTED 2026-08-25 (PR #1565 review round 2, driver finding F2).** This line previously read, in full:

> *"**Recommended default: (a).** Three independent reasons converge, not one:"*

It was **wrong to leave standing** after the amendment at the top of this card moved the default to (c). For
two review rounds the card named two defaults — this line said (a), the glance table said (c) — so a ruler
reading only one of them would have ratified the option the amendment displaced. The recommendation is now
**(c)**, for the four reasons under *"Why (c) displaces (a)"* above.

The three reasons below are **kept, and they still hold — as the case for (a) over (b)**, which is what they
were written to be. None of them argues against (c): reason 1 asks for a self-contained WE-side mechanism and
`dispatch-lane` is one; reason 2 is a coverage argument against (b)'s single HTTP endpoint, and (c)'s own
coverage gap is #3165 plus the two unfiled kinds (see point 4 above); reason 3's statute argues for calling
the declared operation, which is exactly what (c) does. Read them as *why not (b)*, not as *why (a)*:

1. **The conveyor's own statute.** `we:docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent`
   (#2701, ratified 2026-07-27) frames the per-lane cycle as driven by "a headless runner over the tested
   tick-core state machine" with "no model context spent per tick" — a self-contained mechanism over WE's
   own tested scripts. Clause 1 doesn't use the literal words "no external server," but a runtime dependency
   on a second repo's dev server process for the critical path is a plain reading of what that self-contained
   shape excludes.
2. **Coverage.** (b) only has an HTTP counterpart for one of five dispatch kinds today (`build`); the other
   four (`prepare-scope`, `prepare-decision`, `fix`, `CI-heal`) would need new `plateau-app` endpoints built
   from scratch, while (a) reuses one ported module for all five uniformly.
3. **Statute-overlap finding (new, surfaced in this prep pass).** `we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated`
   (#3031, ratified 2026-08-08) rules, for the sibling "declared delivery operation" engine (#3029), that
   model work needing a tree is "an agent session per #agent-runner-cli-backend" — never routed through an
   HTTP service — and its reconciliation footnote states verbatim: *"The rejected branch — agents calling
   HTTP services — fails on lane clones (N checkouts, N ports, no answer to 'which server acts on which
   clone') and on the session-free direction of #2701/#2703."* #2701/#2703 are this item's own governing
   statute and its own immediate predecessor story — #3031's authors were writing with this exact context in
   view, not by coincidence.

> **Scope of the two skeptic/screen passes below (2026-08-16), stated so they are not misread as operative.**
> Both ran against a survey that contained only (a) and (b). Where they say "the default", they mean **(a)**,
> and "the default survives" means *(a) survives (b)* — the only comparison they were given. **Neither pass
> saw (c), so neither is evidence for or against the amended default.** A fresh skeptic pass over (a)-vs-(c)
> has not been run and is owed at the decision turn.

`Skeptic: SURVIVES-WITH-AMENDMENT.` Attacked on four axes (agent-spawn concurrency was globally saturated
during this prep session — every subagent launch hit the environment's concurrency cap and errored before
running; this attack was therefore run in-line rather than via a separate throwaway agent process, holding
the same "assume the default is wrong" posture the skill specifies. Re-run via a real fresh agent at the
decision turn if one is available then).
  - *(0) Classification* — is branch (b) actually *broken* (a forced invariant, not a live fork)? Close, but
    not quite: nothing stops someone from building the HTTP endpoints; (b) is excluded by two independently
    ratified statutes' design intent, not by literal infeasibility. Kept as a genuine `## Fork N` rather than
    dissolved to a forced invariant, because an operator explicitly wants this ratified (#3118's own
    "Done when" and both parent epics call it "the open fork") — SURVIVES as fork-shaped.
  - *(1) Merit* — steelmanned (b): `plateau-app` already runs the tested, independently-reviewed code, and
    porting duplicates CLI-spawn logic across two repos that can drift; the epic's own DAG (#2753, step 5)
    names a *later*, larger `#2445`/`#2527` "Plateau Loop app that hosts the runner with no session" as the
    eventual session-free home — doesn't that make WE-native infra short-sighted? **REFUTED as an objection
    to (a):** #2445/#2527 is a *different, later* system — the product that eventually may absorb or replace
    the *whole conveyor*, not a reason to keep today's conveyor dependent on a dev server in the meantime.
    Whichever way this fork resolves, it doesn't foreclose or complicate that later migration; the ported
    module is small (roughly 400 lines across the four source files) and already frozen behind the ratified
    #2444 contract — low drift risk relative to standing up cross-repo endpoint coverage for four more verbs.
    Default SURVIVES.
  - *(2) Statute-overlap* — does #3031 actually authorize this call, given it literally governs a *different*
    system (the operation-engine's judge/effect steps, #3029), not the conveyor's tick-core? **SURVIVES-WITH-AMENDMENT:**
    downgrade #3031 from "authority that already answers this" to "strong supporting precedent, explicitly
    textually bridged to #2701/#2703 by its own reconciliation footnote" — persuasive analogous ruling, not a
    literal ruling on *this* fork. Folded into the default's rationale above (reason 3) at that weight, not a
    higher one.
  - *(3) Citation-scope* — does #2701 literally forbid an external-server call, or is "no external server in
    the loop" an inference stretched beyond the statute's actual words? **SURVIVES-WITH-AMENDMENT:** #2701's
    text rules on "no per-lane LLM conductor" (clauses 1-2) and "no model context per tick," not verbatim on
    servers; "no external server dependency" is a reasonable but *inferred* reading of clause 1's
    self-contained-mechanics framing, now stated as inference rather than verbatim citation (reason 1 above
    reworded accordingly).

`Screen: clear.` Fresh-context check, two questions: **(1) impl-vs-standard** — this isn't a WE↔FUI
standard/impl-boundary call at all (no intent/component axis here); it's a WE↔plateau-app *constellation
placement* call, and the branches are operationally observable, not a hidden impl detail — whether the
conveyor keeps dispatching when `plateau-app`'s dev server is down is directly felt by whoever operates it.
**(2) merit-vs-prioritization** — strip cost/effort from both branches (imagine both instantly built and
maintained): a difference still remains — (b) still couples the conveyor's liveness to a second process
being up and still can't address a lane-clone dev server on an unknown port, which is an architectural
property, not a cost. Merit survives free-build; this is a real fork, not prioritization in fork costume.

`Skeptic (fresh-context, 2026-08-16): independently corroborated.` A separate, genuinely independent
fresh-context agent (not this item's author) subsequently re-ran the 4-axis skeptic attack above, including
a steelmanned merit check on the rejected (b) cross-process HTTP-call option, and confirmed the recommended
default (a, the WE-native runner) survives. Every citation was checked against live files and checked out
exactly, with no fabrications found: `plateau-app:src/build-runner/build-action.ts` lines 236/244/307,
`plateau-app:src/build-runner/runner.ts` lines 55-232, `we:skills-src/conveyor/runner.mjs` lines 81-95,
`we:skills-src/conveyor/SKILL.md:29-41`, and
`we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated` lines 3108-3110.

`Screen (fresh-context, 2026-08-16): clear.` The same independent pass re-ran the two-confusion screen
(impl-vs-standard, merit-vs-prioritization) and it came back clear, matching the self-run screen above. This
is independent corroboration of the original self-run skeptic/screen pass's conclusions above — not a
supersession of them.

**Duplication sub-call — MOOT under the amended default (c), kept as the record of the (a)-vs-(b) weighing.**
This sub-call priced the duplication (a) would create. Under (c) there is nothing to price: nothing is ported,
so no second copy of the CLI-spawn logic is written, and the sub-call's "accept the duplication as-is"
recommendation has no subject. It survives here because it is part of why (a) beat (b), not as a live
recommendation. Its heading previously read *"(folded into the default, not left open)"*, which was **wrong to
leave standing** once (c) became the default — (a) is not the default any more, so nothing is folded into it.
The original text follows unchanged:

(a) does mean the CLI-spawn logic exists
in two repos (`plateau-app:src/build-runner/`, and the new `we:scripts/conveyor/agent-runner.mjs`) rather
than one shared module. No shared-package/monorepo-workspace tooling exists between WE and `plateau-app`
today (checked: no npm workspace, no submodule, no publish pipeline) — building one now is out of scope
for closing this critical path. **Recommended: accept the duplication as-is for now.** The ported surface is
small and frozen behind the already-ratified #2444 contract (low drift risk); if drift becomes a real
recurring cost, extracting a shared runner package is the natural follow-up, filed then against measured
pain — not spent now against a hypothetical one. (Moving the conveyor's own runtime into `plateau-app`
outright, dissolving the duplication the other way, stays out of scope here as the original filing noted —
it is the #2445/#2527 product question, a much bigger call.)

**RETRACTED 2026-08-25 (PR #1565 review round 2, driver finding F2).** The ratification text below previously
read, in full:

> *"On ratify, `codifiedIn` would record the runner-backend module + a `we:docs/agent/platform-decisions.md`
> anchor for "the conveyor's headless dispatch spawns agents via an **in-process CLI-backend runner**, never a
> cross-process call into a sibling repo's dev server"..."*

That was **wrong to leave standing** after the default moved to (c): "the runner-backend module" and
"in-process CLI-backend runner" are (a)'s shape. (c) writes no module and spawns nothing in-process — it is a
detached child process started through a declared operation. Ratifying from the old sentence would have
codified the option this amendment displaced. Corrected:

On ratify, `codifiedIn` would record **no new module** — `we:scripts/operations/dispatch-lane.mjs` gains the
conveyor's runner as a caller — plus a `we:docs/agent/platform-decisions.md` anchor for "the conveyor's
headless dispatch starts agents by calling the declared `dispatch-lane` operation, never by a second spawn
implementation and never by a cross-process call into a sibling repo's dev server" — composing with, not
competing against,
[#conveyor-orchestration-mechanics-not-per-lane-agent](/docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent)
and [#operations-declared-once-callers-generated](/docs/agent/platform-decisions.md#operations-declared-once-callers-generated).

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (blast-radius signal — this touches the conveyor's dispatch core, system machinery).
**RETRACTED 2026-08-25 (PR #1565 review round 2, driver finding F2).** The predicted touch-set previously read,
in full:

> *"Predicted touch-set for the buildable child **this fork's default** would spawn:
> `we:scripts/conveyor/agent-runner.mjs` (new), `we:skills-src/conveyor/runner.mjs`,
> `we:skills-src/conveyor/SKILL.md`."*

That was **wrong to leave standing** after the default moved to (c). It bound this pre-registered jury to
(a)'s scope, and said in words that it was "this fork's default" — but under (c),
`we:scripts/conveyor/agent-runner.mjs` never gets written. Corrected:

Predicted touch-set for the buildable child the amended default (c) would spawn: **no new module** —
`we:skills-src/conveyor/runner.mjs` (calls `dispatch-lane` per surfaced dispatch),
`we:scripts/operations/dispatch-lane.mjs` and `we:scripts/operations/dispatch-lane-io.mjs` (the three-kind
coverage from #3165, the two unfiled kinds, and the observer defect retracted above),
`we:skills-src/conveyor/SKILL.md` (retire the "interim bridge" section). This jury binds against that
predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

## THE CALL (operator, 2026-08-26): Fork 1 → **(c) call the existing `dispatch-lane` operation**

Ratified by the operator (Nicolas Gilbert) on 2026-08-26. The conveyor's headless dispatch starts agents by
**calling `we:scripts/operations/dispatch-lane.mjs` once per surfaced dispatch**. No new module is written,
nothing is spawned in-process, and no cross-process call into `plateau-app`'s dev server is introduced.
(a) — a new `we:scripts/conveyor/agent-runner.mjs` — and (b) — HTTP into `plateau-app` — are both rejected.

Codified as
[#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation).

### Why — the four reasons that make this ruling checkable later

**1. The fork's own opening paragraph forbids (a), not only (b).** That paragraph rejects supporting two
branches because it *"would mean two live spawn implementations behind the same five-verb contract with
independent failure modes, which is exactly the second-implementation shape #deterministic-core-thin-judgment's
one-source clause forbids."* A new `we:scripts/conveyor/agent-runner.mjs` sitting beside `dispatch-lane`'s
existing `claude --bg` spawn **is that shape**. The argument was aimed at (b) and lands on (a) just as hard.
This is the reason the amendment's author wrote first, and it is the reason the ruling rests on: the card
argued itself out of its own original default.

**2. The steer question the fork originally turned on was PROBED, not argued — on one run, and that run cuts
both ways.** An earlier version of this card made mid-flight steering the pivot — if the conveyor needs to
steer, (a)'s richer `spawn/steer/stop/resume/observe` contract earns its second implementation. That was
addressed by measurement on 2026-08-25, not by reasoning: a detached `--bg` agent was stopped, then resumed
with `claude --resume <sessionId>` and new instructions, and answered with a sentinel planted before the
stop — **context preserved, in that one run**. So "steer while keeping the work" is reachable under (c) *as a
mechanism*, as stop-then-resume rather than as a `steer(text)` write to a live stdin. That is a coarser verb,
not a missing capability, and the pivot the fork turned on is gone.

> **CORRECTED 2026-08-26 (PR #1583 review, `correctness` lens, operator override).** The paragraph above
> originally ended at *"**context preserved**. So 'steer while keeping the work' is reachable under (c)"* and
> asserted it as settled fact. **That was wrong in one specific way, and the wrongness was an asymmetry
> inside this card**: the very same manual run produced a second row — `--session-id` **ignored** on a `--bg`
> spawn (the probe table above, third row) — which this card treats as untrustworthy, files `#3331` over,
> and demands be *"repeated at least three times"* before it is believed. Same table, same run, opposite
> evidentiary standard.
>
> Worse than asymmetry, **the two rows are coupled and this card never said so**. `claude --resume` addresses
> a session **by its id**. If `--bg` discards `--session-id`, the dispatcher does not know the id of the agent
> it started, so it cannot resume it — and reading the real id back is, by this card's own probe-table note,
> *"work that does not exist yet"*. So row 2 is reachable only if row 3 turns out false, or after `#3331`'s
> remedy is built. Re-verified 2026-08-26:
> `grep -rnE -- '--resume|resumeAgent|steer'` over `we:scripts/operations/dispatch-lane-io.mjs`,
> `we:scripts/operations/dispatch-lane.mjs` and `we:scripts/conveyor/tick-core.mjs` returns **nothing** — at
> this card's citation basis (`main` at `3b2aeded`, which this PR leaves untouched) **and** at `main` as it
> stands today (`1ed16d63`), where those two modules have since been reworked. *(This sentence first pinned
> the result to "this branch's head `3447eb27`", which two later fix commits made **wrong** as a label — the
> grep result never changed, only the sha it named. Re-pinned to a basis that does not chase the head.)*
>
> **What is not retracted:** the operator's ruling that context-preserving stop-then-resume is a *sufficient*
> requirement. That is a judgment call and it stands. What is corrected is the separate **factual** claim that
> the conveyor can reach the mechanism — that is unverified, and it now has an owner (`#3331`) and a
> revisit trigger (clause 3, trigger (ii)).
>
> **Prevention filed: `#3333`** — a `check:standards` rule requiring a statute clause that rests on a
> manual observation to cite either a test or an OPEN verification card, the two-exit shape `#2844` already
> enforces for operational invariants (`we:scripts/lib/validate-rules-anchors.cjs:249`). The finding recorded
> it as OWED; nothing detected this asymmetry, a human re-read did. Sibling of `#3281`, the prevention the
> previous round filed against this same card.

**3. The hinge — the one capability (c) can never reach, and the operator ruled on it directly.** (c) cannot
steer a **running** agent **without interrupting it**. Stop-then-resume, by construction, interrupts. The
operator was asked this question directly and ruled that **context-preserving stop-then-resume satisfies the
requirement**. That is the load-bearing acceptance of this whole decision.

**Two things revisit this ruling, not one.** Both are carried into the statute as clause 3's triggers:

1. **If the requirement ever changes from "steer while keeping the work" to "steer without ever
   interrupting"** — no stop-then-resume backend can reach that, and the case for a second spawn
   implementation would have to be re-argued from the start. *Hypothetical: nothing has asked for it.*
2. **If `#3331`'s probe comes back negative** — if `claude --bg` really does discard `--session-id`, the
   dispatcher cannot address the session it started, and stop-then-resume is not reachable as designed until
   `#3331`'s `Done when` #3 remedy (read the real id back off `claude agents --json`) is built. *Live
   today: that is exactly what the one manual run reported.*

*(Trigger 2 added 2026-08-26 on the PR #1583 review. This section originally named trigger 1 as the only one,
which was **wrong** — it made the hinge revisitable only on a change that has not happened, while the
condition that could actually undercut it is open right now. See the correction under reason 2.)*

**4. (c)'s costs are ACCEPTED, not waived.** Four of them, each named rather than smoothed over:

- **It depends on `#3165` landing first.** The ruling makes this decision downstream of a card that is still
  `status: open`.
- **`#3165` buys three of the five dispatch kinds, not five** — `build`, `prepare-scope`, `prepare-decision`.
  Verified: `grep -c 'spawnFixes\|spawnCiHeals\|ciHeal\|CI-heal'` over
  `we:backlog/3165-tick-core-plans-auto-prepare-scope-dispatches-that-never-act.md` returns **0**. The card's
  own text names `'build' | 'prepare' | 'prepare-decision'` at its `:68` and `:131`.
- **The other two kinds had no card. They do now: `#3332`.** `we:scripts/conveyor/tick-core.mjs:860-861`
  plans `spawnFixes` and `spawnCiHeals`; `we:scripts/operations/dispatch-lane-io.mjs:139` launches
  `match(decisions.spawnBuilds)` only, and `briefPath` at `:52` takes no kind. After `#3165` lands, three of
  five kinds dispatch through the operation and two still do not.
- **It inherits an unproven handle assumption, and that now has a card too: `#3331`.** The sink mints the
  session id (`we:scripts/operations/dispatch-lane-io.mjs:558`) and pins it with `--session-id` (`:621`); the
  observer matches on that same minted value (`:738`). A single manual run suggested `claude --bg` ignores
  `--session-id`. `#3331` probes it before anything is fixed, because one observation is not evidence.
  **`#3331` owns two things, not one** *(added 2026-08-26, PR #1583 review — this bullet originally named
  only the observer, which under-stated it)*: reason 3's hinge rests on the **same** unproven fact, because
  `claude --resume` addresses a session by its id. If the probe comes back negative, the observer cannot see
  its agents **and** the dispatcher cannot resume them.

### Corrections this ruling makes to the card above it

Recorded rather than silently applied, per this card's own established practice.

- **The line numbers in the amendment's citations have drifted.** They were written against an earlier
  revision. Verified against `main` at `3b2aeded`, the current lines are: `mintSessionId` at **`:558`** (card
  says `:555`), the `--session-id` argv at **`:621`** (card says `:618`), the observer's
  `sessions.find(… === handle)` at **`:738`** (card says `:735`), `handle` read off the entry at **`:693`**
  (card says `:690`), and the sink header at **`:507-534`** (card says `:507-514`). The substance of every
  cited claim checks out at the new lines; only the numbers moved.
- **The sink's "not proven" comment has been reworded since the card quoted it.** The card quotes `:528` as
  *"NOT YET PROVEN LIVE… the argv below is asserted, the CLI's response to it is not"*. `:528-534` now reads
  *"PROVEN AGAINST A PROCESS, NOT AGAINST THE REAL CLI… What is still NOT proven: no dispatch has been fired
  end to end, and the REAL CLI's response to this argv remains unasserted."* Same meaning, and the assumption
  is still unproven — but the quote is no longer verbatim.
- **The card points at "#3096" for the first live run; the code points at `#3096`.** Those are the same
  item — `we:backlog/3096-route-the-conveyor-s-build-dispatch-through-the-declared-dis.md` has
  `bornAs: 3096`. Not an error, recorded so the next reader does not have to resolve it again.
- **The observer defect is narrower than the card states, and still real.** The card says a `--session-id`
  mismatch means the observer *"reports every real dispatch as `unresolved`"*. The observer tries the **PR
  axis first** (`we:scripts/operations/dispatch-lane-io.mjs:695-729`), and a merged PR still returns
  `succeeded` at `:716-724` regardless of the session id. The accurate claim is the one `:731-732` makes
  about the liveness axis itself — it is *"what answers while no PR exists yet, which is every dispatch for
  most of its life"* — so a dispatch would read `unresolved` for its entire pre-PR life, two minutes
  (`DISPATCH_LISTING_GRACE_MINUTES = 2`, `we:scripts/operations/dispatch-lane.mjs:111`) after it starts. That
  is the version `#3331` carries.

### What was NOT re-run, stated so it is not mistaken for done

The card itself flags that *"a fresh skeptic pass over (a)-vs-(c) has not been run and is owed at the
decision turn."* **It still has not been run.** Both recorded skeptic passes and both screens ran against a
survey containing only (a) and (b), and neither is evidence for or against (c). The operator ruled without
it. That is the operator's call to make, and this line exists so nobody later reads the two `SURVIVES` marks
above as endorsements of the option that actually won.

## Why this is a new item, not a rebuild of #2464

#2464 asked to "build the phase-1 runner... behind a stable runner interface" — read literally, that
already happened (#2530). Re-running #2464 as scoped would duplicate `plateau-app:src/build-runner/runner.ts`
without deciding the one open question (where the conveyor calls it from), which is exactly the kind of
premise-moved-past-reality gap `we:agent-memory-src/story-preparation-checklist.md` calls out (see its
#2803 example). #2464 has been resolved (`graduatedTo: 2530`) with a pointer here; this item is the actual
remaining critical-path decision #2753 (Phase B, item 1) and #3102 (Phase B) both still reference by
#2464's number.

## Done when

- [x] `#2753` and `#3102`'s Phase-B critical-path line points at this item's resolution/successor build item,
  not `#2464`. *(Verified 2026-08-16 — both already cite `#3118` directly: #2753's DAG item 1 and #3102's
  Phase B paragraph. No edit needed.)*
- [x] The fork above is ratified (explicit operator utterance, not inferred). *(Ruled 2026-08-26 by the
  operator — Fork 1 → (c). See [THE CALL](#the-call-operator-2026-08-26-fork-1--c-call-the-existing-dispatch-lane-operation).)*

## Successors

The ruling accepts costs rather than waiving them. **Five rows, each with an owner**, so none of them lives
only in this card's prose:

| what | where it is carried |
| --- | --- |
| three of five dispatch kinds routed through the operation | `#3165` (open) |
| the other two kinds — `spawnFixes`, `spawnCiHeals` | **`#3332`** (filed 2026-08-26 by this ruling) |
| the unproven `--session-id` handle assumption the observer rests on | **`#3331`** (filed 2026-08-26 by this ruling) |
| **the ruling's hinge — stop-then-resume presupposes addressing the session by its id, the same unproven fact** | **`#3331`** (scope widened 2026-08-26 on the PR #1583 review) |
| the first end-to-end live dispatch through the operation | `#3096` (open, `bornAs: 3096`) |

*(**CORRECTED 2026-08-26, PR #1583 review.** This paragraph read **"The ruling accepts three costs; each has
an owner now, so none of them lives only in this card's prose"** over a four-row table. Both halves were
wrong. The count was wrong — the table listed four. And the claim itself was wrong in the way that mattered:
the hinge, the ruling's own load-bearing acceptance, **was** a cost living only in this card's prose, with no
owner, because nobody had noticed it rests on the same unproven `--session-id` fact `#3331` was already
filed over. It is row 4 now.)*
