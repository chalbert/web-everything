---
kind: decision
parent: "142"
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: 1663
codifiedIn: one-off
preparedDate: "2026-06-23"
relatedTo: ["1639", "1646", "1649"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, repro, handoff, replay, ai-generated, validation, decision]
---

# Shareable full-context repro bundle for the dev browser

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether the capability is worth building on pure merit, not which of two designs wins.** The idea: instead of a teammate filing "it's broken, here are some screenshots," the dev browser exports the *full semantic context* of a moment — declared state + the action trace that led there + the page's declared rules + ownership — as one replayable link the recipient opens to land in the exact same place. The decision is a **go / no** merit gate, not a design fork (there is no rival design contesting the same slot — see *Why this isn't a classic fork*).

**RESOLVED 2026-06-23 — verdict: GO.** Judged on pure merit (*could this be useful to a dev anywhere?* — yes): full-context semantic repro is a real, on-moat capability no incumbent can produce without the declared model underneath. Graduated to epic **[#1663](/backlog/1663-shareable-full-context-repro-bundle/)**, sliced across the constellation: contract → WE **[#1664](/backlog/1664-repro-bundle-contract-shape-of-declared-state-action-trace-r/)**, viewer/replay UI → FUI **[#1665](/backlog/1665-repro-bundle-viewer-and-replay-ui-components/)**, export+replay tool → plateau **[#1666](/backlog/1666-repro-bundle-export-and-replay-tool-in-the-dev-browser/)**.

## What you're deciding

Does Web Everything commit to a **shareable full-context repro bundle** as a dev-browser feature — and if so, on what trigger does it become a build? Concretely, the artifact would bundle:

- **Declared state** — the introspectable state snapshot (not a DOM dump): which providers/contexts held what value at the captured moment.
- **Action trace** — the ordered semantic actions (intents fired, state transitions) that produced that state, replayable step-by-step.
- **Declared rules** — the page's own conformance/visibility/validation rules in force, so the recipient sees *why* a state was (dis)allowed.
- **Ownership** — who owns each component/rule/state in the bundle (the #142 "best person does the work" thread), so the repro self-routes.

…serialized to one link a teammate opens in the dev browser to **replay into the identical context**.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or here — no rival "build it shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided merit gate** on an AI-generated idea: build it or don't, judged purely on whether the capability is worth having. Per the user directive that is still a `decision` card — "anything I want to decide" — it just resolves to a **go/no verdict** on merit, not a winning branch. Resolved GO (below).

## Context & prior art delta

The category exists and is crowded — the delta is *semantic bundle vs opaque recording*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Replay.io** | A deterministic recording of the browser you can time-travel/inspect | A *recording of pixels+JS*, not a bundle of **declared** state/rules/ownership; tied to its own runtime |
| **Jam.dev / Bird Eats Bug** | A bug link with console + network + repro steps | Heuristic capture of logs; no declared-rule or semantic-state model, no ownership |
| **Sentry Session Replay** | Post-hoc replay of a user session for an error | Production-error-shaped, opaque DOM diffing; not a dev-time *handoff* artifact, no rules/owner |
| **Loom / screenshots** | A human narrates the problem | Zero machine-actionable context; recipient rebuilds state by hand |

The moat (per #142): a WE app is **self-describing**, so the bundle is *semantic, portable, verifiable* — it carries meaning (intents, declared rules, ownership), not a stack-bound pixel/JS recording. That's the thing none of the incumbents can produce without the declared model underneath.

## Dependencies & lineage

- **Rides the shared capture substrate.** #142 names the *trace/replay capture artifact* as a shared mechanism most of these features depend on — this bundle is its **handoff/export unit**. The plateau export+replay slice (#1666) consumes that capture; it's a `blockedBy` prerequisite on that one slice, not a gate on the contract (#1664) or UI (#1665).
- **Generalizes [#1639](/backlog/1639-semantic-handoff-packets-between-roles/)** (semantic handoff packets between roles) — per #142's triage, #1639 is a **duplicate that folds into this work**: the repro bundle *is* the concrete debugging handoff packet, so #1639 is one packet type over the same contract, not an upstream blocker.
- **Adjacent:** [#1646](/backlog/1646-scenario-and-fixture-library-that-doubles-as-e2e-fixtures/) (captured scenarios that double as fixtures) and [#1649](/backlog/1649-branch-and-run-diff-in-the-dev-browser/) (branch/run diff) ride the same capture artifact — coordinate so capture is built once.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule (no per-call backend to host the bundle).

## Resolution — GO (2026-06-23)

- **Verdict: GO, judged on pure merit.** The only question that matters: *could a full-context semantic repro bundle be useful to a dev anywhere?* Yes — it's a real, on-moat capability. (Demand/urgency arguments are explicitly out of scope: a private, unpublished project always has zero observed demand, so "no demand yet" is never a valid reason to gate a build.)
- **Build now, release later.** The constellation split makes the capture-substrate dependency a per-slice `blockedBy` edge, not a gate on the whole feature: the WE contract (#1664) and FUI viewer (#1665) are unblocked and independently valuable; only the plateau export+replay tool (#1666) rides the #142 trace/replay capture substrate, and that's encoded as its real prerequisite. Nothing is parked.
- **Graduated to epic [#1663](/backlog/1663-shareable-full-context-repro-bundle/)** → slices **[#1664](/backlog/1664-repro-bundle-contract-shape-of-declared-state-action-trace-r/)** (WE contract, agent-ready now), **[#1665](/backlog/1665-repro-bundle-viewer-and-replay-ui-components/)** (FUI UI), **[#1666](/backlog/1666-repro-bundle-export-and-replay-tool-in-the-dev-browser/)** (plateau tool).
- **Skeptic:** "Jam.dev already nails repro links — this is reinventing a solved problem." *Refuted on the delta:* Jam shares a heuristic pixel/log recording; the WE bundle shares **declared state + rules + ownership**, which is exactly what lets it replay into the *semantic* context and self-route — a thing Jam structurally cannot emit without the declared model. Attack does not land → GO ratified.
