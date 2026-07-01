---
kind: decision
parent: "142"
status: open
priority: low
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1631", "1647", "1649"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, scenarios, fixtures, testing, ai-generated, validation, decision]
---

# Scenario and fixture library that doubles as E2E fixtures

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether it earns a roadmap slot, not which of two designs wins.** The idea: while you drive the running app, the dev browser records the *semantic* moment — declared state plus the ordered action trace that produced it — as a named scenario, and that same scenario *is* an E2E/Cucumber fixture. One artifact serves "load me into this state" and "assert this state in CI," so manual exploration directly capitalises into test coverage instead of being thrown away. The decision is a **go / not-yet / no** validation gate, not a merit fork (no rival design contests this slot).

**Recommended verdict: not-yet — accept the candidate as real, gate the build on the shared capture substrate.** **Confidence: Medium.** The state+action semantic model is on-moat and the prior-art delta is clean; what's unproven is demand ahead of the capture/trace artifact it depends on.

## What you're deciding

Does Web Everything commit to a **scenario / fixture library** as a dev-browser feature — and if so, on what trigger does it become a build? Concretely, a recorded scenario would carry:

- **Declared state** — the introspectable snapshot (providers/contexts and their values), not a DOM dump.
- **Action trace** — the ordered semantic actions (intents fired, transitions) that reach that state, replayable.
- **Declared rules in force** — so a fixture asserts not just values but *why* they were allowed.
- **A dual identity** — the recording exports as both a one-click "load this state" seed (overlaps the seed loader #1647) and a runnable E2E/Cucumber fixture, with no separate hand-authoring.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no "shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card — it just resolves to a **go/no/not-yet verdict**, not a winning branch. The genuine sub-question with real tension is the **trigger** (build now vs gate on the capture substrate), handled below.

## Context & prior-art delta

The recorder category is crowded — the delta is *semantic state+action scenario vs recording of clicks*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Playwright / Cypress recorder (codegen)** | Records interactions into a runnable test | Captures *selectors + clicks*; the fixture asserts DOM, not **declared state/rules** — brittle and stack-bound |
| **Cucumber / Gherkin** | Human-readable scenario steps reusable as tests | A prose grammar you hand-author + glue with step code; not *captured* from a running app's semantic model |
| **Storybook play functions** | Scripted interactions pinned to a component state | Per-component, author-written scripts; no app-level state capture, no declared-rule assertion |
| **Chromatic / Percy** | Pins a state for regression | Pixel snapshot of a Storybook story; not a replayable state+action scenario or a CI behavioural fixture |

The moat (per #142): a WE app is **self-describing**, so a captured scenario is *semantic, portable, verifiable* — it records meaning (state, intents, declared rules), which is exactly what lets the same artifact reload a state *and* serve as a robust fixture. None of the incumbents can emit that without the declared model underneath.

## Dependencies & lineage

- **Rides the shared capture substrate — build capture once.** #142 names the trace/replay capture artifact as a shared mechanism; this feature is one consumer of it, alongside [#1631](/backlog/1631-shareable-full-context-repro-bundle-for-the-dev-browser/) (repro bundle) and [#1649](/backlog/1649-branch-and-run-diff-in-the-dev-browser/) (branch diff). Coordinate so capture is built once and these three layer on it.
- **Overlaps the seed loader.** [#1647](/backlog/1647-named-seed-and-scenario-loader/) (named seed / scenario loader) is the "load this state" half; this card adds the "and it's a fixture" half. Decide #1647's scenario shape so the two share one serialization.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule (fixtures live in the repo, no backend to host).

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** The candidate is real (clean delta, on-moat), so don't drop it — but don't open a build now: it depends on the capture substrate that doesn't yet exist, and the dual-use demand is unproven.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the #142 trace/replay capture artifact has shipped in some form, AND **(2)** a flagship exercise-app run produces at least one captured scenario that gets *re-used as a passing CI fixture* — proving the dual identity carries real value, not speculation.
- **Skeptic:** "Playwright codegen already records tests — this is reinventing a recorder." *Refuted on the delta, not on novelty:* codegen records selectors and clicks, yielding DOM-bound, brittle tests; the WE scenario records **declared state + action + rules**, so the fixture asserts meaning and reloads into the *semantic* context — a thing a selector recorder structurally cannot do without the declared model. The residual the skeptic is right about is **timing/demand** — hence not-yet, not go.

*If you'd rather decide go now (open a build story immediately) or no (drop the candidate), say so — the verdict is the thing on the table.*
