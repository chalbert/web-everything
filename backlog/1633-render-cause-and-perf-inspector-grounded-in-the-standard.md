---
kind: story
size: 8
parent: "142"
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: the #142 trace/introspection substrate emits semantic action/state transitions with a render-correlation hook"
priority: low
relatedTo: ["2095"]
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, render-cause, perf, ai-generated, accepted-on-merit, dissolved]
---

# Render-cause and perf inspector grounded in the standard

> **DISSOLVED → accepted on merit** (batch-confirmed per [#2095](/backlog/2095-apply-the-2092-merit-conceded-dissolve-test-to-the-ten-142-v/), applying the [#2092](/backlog/2092-a-merit-conceded-not-yet-is-not-a-decision-it-dissolves-to-a/) merit-conceded dissolve test). The merit is **conceded** — the portability delta is real and on-moat — so this is **no longer an open go/no/not-yet decision**; it is an accepted build gated on its trigger. **Trigger:** the #142 trace/introspection substrate emits semantic action/state transitions **and** a render-correlation hook, **and** a flagship app hits a real redundant/expensive-render case the framework's own profiler can't name semantically. Everything below is retained as the **settled** merit rationale (the concession), not an open question.

## Digest

This AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) earns a go/not-yet/no validation gate, not a merit fork. The idea: when something re-renders, tell the developer **which semantic action or state transition caused it** — and do so in terms of the standard's own model (intents fired, declared state that changed), so the answer is portable across whatever framework actually renders the view. Every existing "why did this render" tool ties its explanation to one framework's reconciler. WE grounds it in the declared action/state model the app already exposes, so the cause survives the framework swap.

**Recommended verdict: not-yet — accept the candidate, gate the build on the trace/introspection substrate.** Confidence: Medium. The portability delta is genuine, but a render-cause inspector is the most substrate-hungry idea in the cluster: it needs both the action/state trace and a way to correlate it to render work, neither of which exists yet.

## What you're deciding

Does Web Everything commit to a **standard-grounded render-cause and perf inspector** as a dev-browser feature — and on what trigger does it become a build? Concretely it would:

- **Attribute a re-render to its cause** — name the intent fired / declared-state transition that triggered the render, not just the component that re-rendered.
- **Speak the standard, not the framework** — express the cause in the app's declared action/state vocabulary so the explanation is the same whether React, Vue, or web components render the view.
- **Surface cost** — flag renders that were redundant or expensive relative to the state change that caused them.
- **Stay portable** — the attribution model is the standard's, so the inspector works across stacks instead of being bound to one reconciler.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "design A vs design B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card, resolving to a **go/no/not-yet verdict** rather than a winning branch. The genuine open sub-question is the **trigger** (build now vs gate on the trace substrate), handled below.

## Context & prior art delta

The category exists and is mature; the delta is *standard-grounded + portable* vs *framework-bound*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **React DevTools Profiler** | Records render commits + flags why a component rendered (props/state/hooks) | Bound to React's reconciler; attribution is in React terms, not portable to other stacks, and not grounded in a declared action/state model |
| **Why Did You Render (library)** | Logs avoidable re-renders with the prop/state diff that caused them | React-only, a code-instrumented library, not a portable inspector over a declared standard |
| **React Scan** | Visual overlay highlighting components re-rendering + perf hotspots | React-specific overlay; shows *that* something rendered, not the semantic cause in a cross-stack model |
| **mobx-react-devtools** | Shows which observables triggered a component to re-render | Bound to MobX's reactivity graph; the cause is expressed in MobX terms, tied to that one state library |

The moat (per #142): a WE app declares its actions/state and emits a semantic trace, so the cause of a render can be named in the *standard's* vocabulary and stay true across frameworks. A render-cause answer that survives a framework swap is exactly what every incumbent — each welded to one reconciler — structurally cannot give.

## Dependencies & lineage

- **Rides the trace + introspection substrate (most heavily in the cluster).** #142 names the trace/replay artifact and introspectable model; this inspector needs the action/state trace *and* a render-correlation layer to attribute a render to a cause. Both must exist first — the natural, and most demanding, trigger.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule (attribution runs in-browser over the local trace; no per-call backend).

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** The portability delta is real, so don't drop it — but this is the most substrate-dependent idea in the cluster (needs trace *plus* render correlation), so don't open a build until that exists.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the #142 trace/introspection substrate emits semantic action/state transitions AND a render-correlation hook to map them to render work, AND **(2)** a flagship exercise-app hits a real redundant/expensive-render problem where the framework's own profiler couldn't name the *semantic* cause — evidence, not speculation.
- **Skeptic:** "React DevTools Profiler already answers 'why did this render'." *Refuted on the delta, not on novelty:* the Profiler answers in React's reconciler terms and only for React; the WE inspector names the *semantic* cause (intent/declared-state transition) in a model that's the same across stacks — a portable, standard-grounded answer no framework-welded tool can produce. The residual the skeptic is right about is **substrate readiness** — hence not-yet, not go.

*~~If you'd rather decide go now (open a build story immediately) or no (drop the candidate), say so — the verdict is the thing on the table.~~ (Superseded: dissolved to accepted-on-merit per #2095 — the verdict is settled, not open.)*
