---
kind: decision
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1639", "1646", "1649"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, repro, handoff, replay, ai-generated, validation, decision]
---

# Shareable full-context repro bundle for the dev browser

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether it earns a place on the roadmap, not which of two designs wins.** The idea: instead of a teammate filing "it's broken, here are some screenshots," the dev browser exports the *full semantic context* of a moment — declared state + the action trace that led there + the page's declared rules + ownership — as one replayable link the recipient opens to land in the exact same place. The decision is a **go / not-yet / no** validation gate, not a merit fork (there is no rival design contesting the same slot — see *Why this isn't a classic fork*).

**Recommended verdict: not-yet — accept the candidate as real, gate the build on a concrete trigger** (the shared trace/replay capture artifact #142 names exists, AND one flagship exercise-app hits a cross-role handoff that screenshots demonstrably can't carry). **Confidence: Medium.** The moat is real and the prior-art delta is clean; what's unproven is demand urgency ahead of the capture substrate it depends on.

## What you're deciding

Does Web Everything commit to a **shareable full-context repro bundle** as a dev-browser feature — and if so, on what trigger does it become a build? Concretely, the artifact would bundle:

- **Declared state** — the introspectable state snapshot (not a DOM dump): which providers/contexts held what value at the captured moment.
- **Action trace** — the ordered semantic actions (intents fired, state transitions) that produced that state, replayable step-by-step.
- **Declared rules** — the page's own conformance/visibility/validation rules in force, so the recipient sees *why* a state was (dis)allowed.
- **Ownership** — who owns each component/rule/state in the bundle (the #142 "best person does the work" thread), so the repro self-routes.

…serialized to one link a teammate opens in the dev browser to **replay into the identical context**.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or here — no rival "build it shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive, that is still a `decision` card — "anything I want to decide" — it just resolves to a **go/no/not-yet verdict**, not a winning branch. The genuine sub-question with real tension is the **trigger** (build now vs gate on the capture substrate), handled below.

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

- **Rides the shared capture substrate.** #142 names the *trace/replay capture artifact* as a shared mechanism most of these features depend on — this bundle is its **handoff/export unit**. It can't ship before some form of that capture exists; that dependency is the natural trigger.
- **Generalized by [#1639](/backlog/1639-semantic-handoff-packets-between-roles/)** (semantic handoff packets between roles) — the repro bundle is the debugging-specialized case of the general handoff packet. If #1639 is built, this is one of its packet types; decide #1639's shape before over-building this.
- **Adjacent:** [#1646](/backlog/1646-scenario-and-fixture-library-that-doubles-as-e2e-fixtures/) (captured scenarios that double as fixtures) and [#1649](/backlog/1649-branch-and-run-diff-in-the-dev-browser/) (branch/run diff) ride the same capture artifact — coordinate so capture is built once.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule (no per-call backend to host the bundle).

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** The candidate is real (clean prior-art delta, on-moat), so don't drop it — but don't open a build now: it depends on the capture substrate that doesn't yet exist, and demand is unproven.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the #142 trace/replay capture artifact has shipped in some form, **AND (2)** a flagship exercise-app run surfaces a real cross-role handoff that screenshots/Jam demonstrably can't carry (evidence, not speculation).
- **Skeptic:** "Jam.dev already nails repro links — this is reinventing a solved problem." *Refuted on the delta, not on novelty-for-its-own-sake:* Jam shares a heuristic recording; the WE bundle shares **declared state + rules + ownership**, which is exactly what makes it replay into the *semantic* context and self-route — a thing Jam structurally cannot emit without the declared model. The residual the skeptic is right about is **urgency** — hence not-yet, not go.

*If you'd rather decide go now (open a build story immediately) or no (drop the candidate), say so — the verdict is the thing on the table.*
