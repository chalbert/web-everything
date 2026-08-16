---
bornAs: x501fk9
kind: decision
parent: "2753"
status: open
dateOpened: "2026-08-15"
preparedDate: "2026-08-16"
relatedReport: reports/2026-07-12-claude-cli-agent-runner-headless-contract.md
relatedTo: ["2464", "2530", "2444", "2703", "3102", "3031"]
tags: [plateau-loop, conveyor, agent-runner, session-free]
---

# Session-free conveyor: where does headless agent-spawning live -- WE-native runner vs a cross-process call into plateau-app's build-runner

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

| Fork | The call | Default | Main alternative (excluded) | Confidence |
|---|---|---|---|---|
| 1 | Where the agent-spawn backend lives | **(a) WE-native runner** — port the contract into `we:scripts/conveyor/agent-runner.mjs`, wired in-process into the conveyor's dispatch | (b) cross-process HTTP call into `plateau-app`'s `POST /api/backlog/build` | high |

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
  dependency on `plateau-app`'s dev server being up. **DEFAULT.**
- **(b) Cross-process call into `plateau-app`.** The conveyor's runner calls `plateau-app`'s existing
  `POST /api/backlog/build` (or new sibling endpoints for the other four kinds) over HTTP, reusing #2530's
  shipped code instead of porting it. *Rejected* — see Skeptic below.

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

**Recommended default: (a).** Three independent reasons converge, not one:

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

**Duplication sub-call (folded into the default, not left open).** (a) does mean the CLI-spawn logic exists
in two repos (`plateau-app:src/build-runner/`, and the new `we:scripts/conveyor/agent-runner.mjs`) rather
than one shared module. No shared-package/monorepo-workspace tooling exists between WE and `plateau-app`
today (checked: no npm workspace, no submodule, no publish pipeline) — building one now is out of scope
for closing this critical path. **Recommended: accept the duplication as-is for now.** The ported surface is
small and frozen behind the already-ratified #2444 contract (low drift risk); if drift becomes a real
recurring cost, extracting a shared runner package is the natural follow-up, filed then against measured
pain — not spent now against a hypothetical one. (Moving the conveyor's own runtime into `plateau-app`
outright, dissolving the duplication the other way, stays out of scope here as the original filing noted —
it is the #2445/#2527 product question, a much bigger call.)

On ratify, `codifiedIn` would record the runner-backend module + a `we:docs/agent/platform-decisions.md`
anchor for "the conveyor's headless dispatch spawns agents via an in-process CLI-backend runner, never a
cross-process call into a sibling repo's dev server" — composing with, not competing against,
[#conveyor-orchestration-mechanics-not-per-lane-agent](/docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent)
and [#operations-declared-once-callers-generated](/docs/agent/platform-decisions.md#operations-declared-once-callers-generated).

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (blast-radius signal — this touches the conveyor's dispatch core, system machinery).
Predicted touch-set for the buildable child this fork's default would spawn: `we:scripts/conveyor/agent-runner.mjs`
(new), `we:skills-src/conveyor/runner.mjs`, `we:skills-src/conveyor/SKILL.md`. This jury binds against that
predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

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
- [ ] The fork above is ratified (explicit operator utterance, not inferred).
