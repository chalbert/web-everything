---
kind: decision
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1632", "1640"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, a11y, conformance, intent, ai-generated, validation, decision]
---

# Intent and a11y conformance inspector

## Digest

AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — a go/not-yet/no validation gate, not a merit fork. The idea: compare a page's **declared intents** — the density, motion, and a11y commitments it states for itself — against what it **actually does** at runtime, and flag the gap. WCAG-and-more checked against *your own declarations*: not "does this meet a generic standard" but "does this match what *you said this page would be*." Generic a11y tools (axe, Lighthouse) check a universal ruleset; none check a page's self-declared intent.

**Recommended verdict: not-yet — accept the candidate, gate on the declared-intent surface.** Confidence: Medium. The declaration-aware delta is real and valuable, but it depends on the introspectable intent model existing, and the generic-a11y portion overlaps the broad conformance line — so scope it as the *intent-conformance* lens, leaning on (not duplicating) existing a11y engines.

## What you're deciding

Does Web Everything commit to an **intent and a11y conformance inspector** as a dev-browser feature — and on what trigger does it become a build? Concretely it would:

- **Read the declared intents** — the density / motion / a11y commitments the page states for itself.
- **Measure reality** — what the rendered page actually does (motion present, contrast, focus order, density).
- **Flag the gap** — surface where reality diverges from the page's *own* declaration (e.g. declared reduced-motion but an animation runs; declared a11y level not met).
- **Cover WCAG too** — fold in generic a11y checks, but framed against the page's declared a11y level rather than as a context-free pass/fail.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "design A vs design B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card, resolving to a **go/no/not-yet verdict**. The genuine open sub-questions are the **trigger** and **how much to reuse existing a11y engines vs build**, handled below.

## Context & prior art delta

The category — automated a11y/quality checks — is mature; the delta is *declaration-aware (intent vs reality)* vs *generic ruleset*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **axe-core** | Rule-based a11y violations on a live page | A universal WCAG ruleset; no notion of a page's *declared intent* (density/motion/a11y level) to check reality against |
| **Lighthouse** | Automated a11y + best-practice audit with a score | Generic audit against fixed heuristics; not measuring conformance to the page's *own* stated commitments |
| **WAVE** | Visual a11y evaluation overlay on a page | Generic WCAG evaluation; no declared-intent model, no density/motion intent conformance |
| **Storybook a11y addon (axe under the hood)** | a11y checks in component isolation | Per-component generic axe checks; not whole-page intent-vs-reality, and no density/motion intent dimension |

The moat (per #142): a WE app **declares its intents**, so the inspector checks reality against *what the page said it would be* — a per-page, self-declared target — not only a universal ruleset. Catching "you declared reduced-motion / a given a11y level / a density and the running page doesn't honor it" is exactly what every generic a11y tool cannot do, because no declared intent exists for them to read.

## Dependencies & lineage

- **Rides the declared-intent + introspection substrate.** #142 names the introspectable intents/declared rules; this inspector reads the declared intents and checks reality against them — it can't ship before that surface exposes them, the natural trigger. (The generic-WCAG portion can reuse an existing engine like axe-core; the *intent-conformance* portion is the net-new part.)
- **Adjacent:** [#1632](/backlog/1632-live-contract-and-data-inspector-at-provider-context-seams/) (live contract/data inspector) is the sibling conformance inspector — both are "declared vs reality" surfaces; share one conformance lens in the dev browser rather than two. [#1640](/backlog/1640-standard-aware-review-assistant/) (standard-aware review assistant) checks declared conformance at review-time; this checks it live in the running page — coordinate the declared-rule reading model.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule (the check runs in-browser against the local declared intents + a local a11y engine; no per-call backend).

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** The intent-vs-reality delta is real and valuable, so don't drop it — but don't open a build until the declared-intent surface exists; scope the generic-a11y portion to reuse an engine like axe-core rather than rebuild it.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the #142 introspectable model exposes per-page declared intents (density/motion/a11y level), AND **(2)** a flagship exercise-app run surfaces a real intent-vs-reality gap (e.g. declared reduced-motion violated, declared a11y level unmet) that a generic axe/Lighthouse pass wouldn't frame as a conformance failure against the declaration — evidence, not speculation.
- **Skeptic:** "axe-core + Lighthouse already cover a11y conformance." *Refuted on the delta, not on novelty:* those check a *universal* ruleset; neither checks reality against a page's *own declared intent* (density/motion/a11y target), because no such declaration exists in their world to read. Intent-vs-reality conformance is the structural gap; the generic part is deliberately *delegated* to those engines, not rebuilt. The residual the skeptic is right about is that the WCAG portion is solved — hence reuse-and-scope, and not-yet, not a fresh go.

*If you'd rather decide go now (open a build story immediately) or no (drop the candidate), say so — the verdict is the thing on the table.*
