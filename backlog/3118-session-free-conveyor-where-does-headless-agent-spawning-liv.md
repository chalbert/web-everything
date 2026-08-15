---
bornAs: x501fk9
kind: decision
parent: "2753"
status: open
dateOpened: "2026-08-15"
relatedTo: ["2464", "2530", "2444", "2703", "3102"]
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

## The fork

- **(a) WE-native runner.** Port the ratified contract into a `we:scripts/conveyor/` (or `scripts/`)
  module — a Node/mjs sibling of `plateau-app:src/build-runner/runner.ts` implementing the same
  `spawn(task)` / `steer(text)` / `stop()` / `resume(text)` / `redirect(text)` / `observe()` ops, wired
  directly into `we:skills-src/conveyor/runner.mjs` so the headless runner spawns agents itself, in-process,
  for every dispatch kind (build / prepare-scope / prepare-decision / fix / CI-heal) — not just "build."
  No runtime dependency on `plateau-app` being up.
- **(b) Cross-process call into `plateau-app`.** The conveyor's runner calls `plateau-app`'s existing
  `POST /api/backlog/build` (or a new sibling endpoint) over HTTP, reusing #2530's shipped code instead of
  porting it. Ties the conveyor's core dispatch loop — today a self-contained chain of WE script shells with
  no server dependency — to a `plateau-app` dev server process being alive, and the existing endpoint only
  knows the "build" verb; the other four dispatch kinds (prepare-scope, prepare-decision, fix, CI-heal) have
  no cross-process counterpart today and would need new endpoints.

**Recommended default: (a).** The conveyor's whole design point (`we:docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent`,
#2701) is a self-contained headless runner that shells tested WE scripts with no external server in the
loop; a cross-process dependency on `plateau-app`'s dev server for the critical path of autonomous delivery
would be a regression from that shape, and would leave four of five dispatch kinds unserved regardless. (a)
does mean the CLI-spawn logic exists in two places (`plateau-app` and WE) rather than one shared module —
this decision should also name whether that duplication is accepted as-is, extracted to a shared package
later, or dissolved by moving the conveyor's runtime to `plateau-app` outright (a much bigger call, out of
scope here). Not run through an independent skeptic or fresh-context screen — this is a filing, not a
ratified default; needs the `/prepare` treatment before ratification.

## Why this is a new item, not a rebuild of #2464

#2464 asked to "build the phase-1 runner... behind a stable runner interface" — read literally, that
already happened (#2530). Re-running #2464 as scoped would duplicate `plateau-app:src/build-runner/runner.ts`
without deciding the one open question (where the conveyor calls it from), which is exactly the kind of
premise-moved-past-reality gap `we:agent-memory-src/story-preparation-checklist.md` calls out (see its
#2803 example). #2464 has been resolved (`graduatedTo: 2530`) with a pointer here; this item is the actual
remaining critical-path decision #2753 (Phase B, item 1) and #3102 (Phase B) both still reference by
#2464's number — **their #2464 references should be repointed here once this item is numbered.**

## Done when

- [ ] The fork above is ratified (explicit operator utterance, not inferred).
- [ ] `#2753` and `#3102`'s Phase-B critical-path line points at this item's resolution/successor build item,
  not `#2464`.
