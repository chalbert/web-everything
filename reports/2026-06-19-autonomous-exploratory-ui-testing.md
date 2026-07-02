# Autonomous exploratory UI testing tool — an FUI-owned devtool that drives a live UI on its own, finds bugs, and gates UI work

**Date:** 2026-06-19
**Epic:** [#1166](../backlog/1166-autonomous-exploratory-ui-testing-tool-fui-owned-engine-that.md)
**Research topic:** `/research/autonomous-exploratory-ui-testing/`
**Locus:** `frontierui` (FUI-owned devtool — zero lock-in)
**Ties:** [#777](../backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit.md) (dogfood site) · [#899](../backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida.md) (conformance vectors) · [#770](../backlog/770-rendered-site-a11y-gate-axe-lane-route-allowlist-we-docs.md) (rendered a11y gate) · [#809](../backlog/809-block-explorer-workbench-render-locus-manipulation-channel-f.md) (block-explorer workbench, FUI-product precedent) · [#855](../backlog/855-decide-the-we-fui-wrapper-handoff-mechanism-for-the-polyglot.md) (generator-is-a-tool precedent)

## The idea

An agent that drives a live web UI **on its own** — clicks, types, navigates — discovers reachable
states, and flags bugs / regressions / odd behaviors **without a pre-written script**. Classic
*autonomous exploratory* (monkey / model-based) testing, LLM-steered. Three first consumers, in priority
order, all over **one engine**:

1. **Stress-test FUI components** (explore mode) — drive each component in the catalog in isolation, hunt
   for crashes and bad states. *The first and primary use.*
2. **Verify the WE docs website works-as-supposed** (explore mode) — sweep the assembled site (nav,
   catalogs render, demos run, no broken/dead-end states). Because of the dogfood goal (#777) the WE site
   renders its chrome *from FUI components*, so this is the same engine pointed at components-in-assembly,
   and it doubles as the rendered-works proof the dogfood epic already wants.
3. **Pre-close gate on UI work items** (gate mode) — an agent finishing a UI story invokes the tool on the
   affected page/component; it must pass before `status:resolved`. Sits alongside `check:standards` and the
   #770 rendered-a11y gate in the close-out flow.

## Placement — FUI-owned devtool, not a WE standard (~85%)

This is an **implementation capability**, not a contract — so by the constellation's standing rules it is
**not** a `@webeverything` standard. It lands in FUI, same family as the block-explorer workbench (#809, a
FUI-owned *product*) and the codegen-is-a-tool ruling (#855, FUI owns zero-lock-in devtools). FUI owns its
components, so the thing that stress-tests them lives with them.

The one WE-facing seam is the **oracle**: for *semantic* correctness (not just "didn't crash") the tester
can check a component against WE's **behavioral-conformance vectors** (#899). That contract crosses the
seam; the engine never does. A later generalization to a *generic* web-UI tester sold as a Plateau product
is a downstream call, explicitly out of scope here.

## Two settled design defaults (recorded, not contested)

The brainstorm surfaced two design questions; both have a clear default that the prior-art survey below
confirms, so they are baked into the build rather than carved as `type:decision` forks.

### A. Oracle layering — generic invariants first, conformance/judge second (~85%)

How does an autonomous tester know something is *wrong* with no script? Layer the oracles cheapest-first:

- **Layer 1 — generic invariants (always-on, day one, zero coupling):** no console errors, no unhandled
  promise rejections, no HTTP 5xx, no axe-core a11y violations, no broken/overflowing layout, no
  dead-end / stuck-focus state, no hard crash. Works on a bare component *and* a whole page. This is the
  Crawljax "invariants that apply to any web application" approach (DOM validity, no error messages,
  back-button correctness) plus the standard web invariant set.
- **Layer 2 — conformance / expectations (opt-in, per target):** WE behavioral-conformance vectors (#899)
  for components that have them; a small "the site should do X" expectation set for the website.
- **Layer 3 — LLM-as-judge (advisory only, never the sole gate):** the WebVoyager pattern — a multimodal
  model judges "did this state look / behave right?". Probabilistic, so it produces *candidate* findings
  for triage, never a hard gate verdict.

The axe-core a11y check in Layer 1 **reuses the existing #770 rendered-site a11y lane** — it is the same
oracle bolted into the explorer, not a second axe integration.

### B. Two invocation profiles — explore vs. gate (~85%)

Exploratory testing is inherently non-deterministic, but a close-out gate must be bounded and reliable. So
the *same engine* runs in two profiles (the field's standard resolution of this tension):

- **Explore mode** — seeded-but-broad, larger step budget, run on-demand / nightly to *hunt* new bugs
  (Consumers 1 & 2). Findings become backlog items. **Never blocks.**
- **Gate mode** — fixed seed, hard step/time budget, fails *only* on hard Layer-1 invariant violations.
  Deterministic, fast, blocking (Consumer 3). Same shape as the deterministic-conformance-gate ruling
  (#463). The seed + step trace is recorded on any failure so it is reproducible.

## Prior art (web survey, 2026-06-19)

The survey validates the architecture and the two defaults end-to-end.

- **Classic monkey testing** — Android UI/Application Exerciser Monkey injects seeded pseudo-random
  gestures until a crash/ANR; its oracle is intentionally minimal (crash-only) and its randomness is
  **seeded so a failing run replays**
  ([developer.android.com](https://developer.android.com/studio/test/other-testing-tools/monkey)). The
  baseline to beat: cheap, but "no crash" misses silently-wrong states and random walks cover state
  poorly.
- **Model-based crawling** — **Crawljax** is the canonical web reference: fire events on candidate
  clickables, detect DOM-state changes, and infer a **state-flow graph** (state = distinct DOM state,
  edge = event) ([ACM TWEB](https://dl.acm.org/doi/10.1145/2109205.2109208),
  [Wikipedia](https://en.wikipedia.org/wiki/Crawljax)); its desktop ancestor is Memon's GUI Ripping /
  event-flow graphs ([UMD](https://www.cs.umd.edu/~atif/papers/MemonSTVR2007.pdf)). This is the explorer
  core — "state = serialized DOM signature, transition = event" gives coverage tracking, dedup, and a
  navigable map. The hard, app-specific knob is *state abstraction* (when are two DOMs "the same state?").
- **Generic invariant oracles** — Crawljax pioneered app-agnostic DOM invariants as oracles (DOM validity,
  no error messages, element discoverability, back-button correctness)
  ([invariant-based testing](https://jpinfotech.org/invariant-based-automatic-testing-of-modern-web-applications/));
  the oracle taxonomy (crash / differential / metamorphic / constraint) is surveyed in *The Oracle Problem
  in Software Testing* ([IEEE TSE](https://dl.acm.org/doi/10.1109/TSE.2014.2372785)). Grounds Layer 1.
- **LLM / agent-driven (2023–2026)** — **WebVoyager** drives real sites from annotated screenshots and
  uses an **LLM as the evaluation oracle** (GPT-4V judges the trajectory, ~85% human agreement)
  ([summary](https://www.emergentmind.com/topics/webvoyager)); **Agent-E** improves task success
  ([arXiv 2407.13032](https://arxiv.org/pdf/2407.13032)). Commercial tools — Mabl, Testim, QA Wolf,
  Octomind (point at a URL → auto-discover + generate self-healing Playwright), Momentic
  ([roundup](https://www.qawolf.com/blog/the-12-best-ai-testing-tools-in-2026)). Grounds Layer 3 — and
  every commercial tool still leans on **human-authored or human-approved assertions** for precise
  correctness, confirming the LLM judge stays *advisory*, never the sole gate.
- **Determinism for gating** — **fast-check** runs each property from a precise **recorded seed** (failing
  seed printed → replayable); the recommended CI pattern is a fixed seed derived from build number/date
  ([fast-check](https://fast-check.dev/docs/introduction/why-property-based/)). **Meticulous** records real
  sessions and **replays them deterministically**, diffing two replays with **no assertions** for
  approve/reject ([meticulous.ai](https://www.meticulous.ai/)). Grounds the explore-vs-gate split exactly:
  seeded-broad to find bugs (non-gating) vs. fixed-seed-bounded to gate (deterministic).
- **Substrate** — **Playwright/Puppeteer** is the de-facto browser-automation substrate (QA Wolf, Octomind,
  Momentic all generate Playwright); **axe-core** (Deque) is the industry-standard a11y engine with an
  official `@axe-core/playwright` binding
  ([guide](https://www.qamadness.com/a-you-oriented-guide-to-axe-core-playwright-accessibility-testing/)).
  Build on Playwright + axe-core; no reason to deviate. (Applitools/visual-diff internals were not directly
  confirmed by the survey — treat visual-diff as a lower-confidence Layer-2 option.)

## Architecture (the build shape)

- **Explorer core** — Playwright driver + Crawljax-style state-flow graph (state = DOM signature; edge =
  fired event), with coverage tracking, state dedup, and a navigable map of discovered states.
- **Oracle bus** — Layer-1 invariant probes bolt onto every visited state (console/promise/5xx/axe-core/
  layout/dead-end); Layer-2 conformance + Layer-3 LLM-judge are pluggable.
- **Two run profiles** — explore (seeded-broad, non-gating) and gate (fixed-seed, bounded, blocking),
  recording seed + step trace on failure.
- **Three driver harnesses** — component-catalog stress (Consumer 1), site sweep (Consumer 2), pre-close
  gate wired into the close-out flow (Consumer 3).

## Slicing

Epic #1166 is a sliced umbrella (children carry the points). Build order:

1. **Explorer engine core** — Playwright driver + state-flow graph + coverage/dedup. The substrate; ready.
2. **Layer-1 generic-invariants oracle bus** — the always-on probe set (reusing the #770 axe lane). Ready.
3. **Explore harness: FUI component-catalog stress-test** (Consumer 1). Blocked on 1 + 2.
4. **Explore harness: WE docs website sweep** (Consumer 2, ties to #777). Blocked on 1 + 2.
5. **Gate mode + pre-close gate on UI items** (Consumer 3). Blocked on 1 + 2.
6. *(Later)* **Layer-2 conformance-vector oracle + Layer-3 LLM-judge** — blocked on #899 (vectors must
   exist). Not carved as a slice yet; tracked here as a deferral.

## Open questions (do not block authoring)

- **State abstraction granularity** — the Crawljax "when are two DOMs the same state?" knob. Tune
  empirically on the FUI catalog; start with a normalized-DOM signature.
- **Visual-diff as a Layer-2 oracle** — needs a baseline store + human approve/reject (Applitools-style).
  Lower confidence; defer until Layer 1 proves out.
- **Generic-product generalization** — a sellable generic web-UI tester on Plateau. Downstream; out of
  scope for this epic.
