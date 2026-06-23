---
kind: decision
parent: "142"
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: 1690
codifiedIn: one-off
preparedDate: "2026-06-23"
relatedTo: ["1652"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, search, navigation, introspection, ai-generated, validation, decision]
---

# Semantic search over the running app

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether it earns a roadmap slot, not which of two designs wins.** The idea: search the *running* app over **meaning**, not text — "find every place that fires the sort intent," "every consumer of the user context," "every component declaring a required field" — and get live, located results. It is grep over the app's declared model rather than over source strings or an AST. The decision is a **go / not-yet / no** validation gate, not a merit fork.

**Recommended verdict: go (build) — Confidence Medium-High.** Unlike its siblings, this feature reads over data the app *already* exposes (introspectable registries / intents / contexts / declared rules); it needs no new capture/trace substrate, so the dependency that gates the rest doesn't gate this. The build is mostly a query + result UI over the existing introspection surface.

## What you're deciding

Does Web Everything commit to **semantic search over the running app** as a dev-browser feature — and (since the verdict is go) confirm scope. Concretely it would let a dev query the live introspection model for:

- **Intent usage** — every site that fires / handles a given intent (e.g. the sort intent).
- **Context/provider consumers** — every component that consumes a given context (e.g. the user context).
- **Declared-rule sites** — every place declaring a given rule/constraint (e.g. a required field, a visibility rule).
- **Located results** — each hit resolvable to its live element (overlaps jump-to-source [#1652](/backlog/1652-jump-to-source-from-any-live-element/)) and its owner.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer, or drop. Per the user directive that is still a `decision` card — here it resolves cleanly to **go**, because the readiness sub-question (does the substrate exist?) answers *yes* for this one.

## Context & prior-art delta

The code-search category is mature — the delta is *semantic query over the running model vs text/AST over static source*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **ripgrep / grep** | Fast find across the codebase | Matches *text*; no notion of intents, contexts, or declared rules — and never the **running** app |
| **GitHub code search** | Repo-wide search, some symbol awareness | Static source index; can't answer "every *live* consumer of this context" |
| **Sourcegraph** | Code intelligence, cross-repo references, some semantic nav | AST/symbol graph over *source*; not the running app's declared model (intents/contexts/rules) |
| **IDE find-usages** | Symbol-accurate references | Language-symbol scope over static code; no concept of intent firing or declared-rule sites at runtime |

The moat (per #142): a WE app is **self-describing**, so search can be *semantic, portable, verifiable* — querying the declared model (intents, contexts, rules, ownership) of the live app. That "grep over meaning, in the running app" is exactly what text and AST tools cannot do without the declared model.

## Dependencies & lineage

- **No new capture substrate needed.** Unlike [#1631](/backlog/1631-shareable-full-context-repro-bundle-for-the-dev-browser/) / [#1646](/backlog/1646-scenario-and-fixture-library-that-doubles-as-e2e-fixtures/) / [#1649](/backlog/1649-branch-and-run-diff-in-the-dev-browser/), this reads over the introspectable registries/intents/contexts the app already exposes — which is why it can go now while they wait.
- **Pairs with jump-to-source.** [#1652](/backlog/1652-jump-to-source-from-any-live-element/) resolves a hit to its declaration in the editor; semantic search produces the set of hits. Build them to share one "live element → source/owner" resolver.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat rule (queries run against the in-browser introspection model; no search backend to host).

## Recommendation

- **Verdict: go (build), Confidence Medium-High.** It rides data already exposed, has a clean prior-art delta, and is on-moat; the only residual is which introspection facets to index first.
- **Concrete scope trigger:** open a build story now; seed it against a flagship exercise-app and ship the three highest-value query types first (intent usage, context consumers, declared-rule sites), then expand. No external pre-req gates it.
- **Skeptic:** "Sourcegraph and find-usages already do semantic code search — why build another?" *Refuted on the delta, not novelty:* those operate on *static source symbols*; WE search queries the **running app's declared model** — intent firings, live context consumers, declared-rule sites with their owners — which no source-AST tool can answer because that model exists only at runtime. The residual the skeptic raises (overlap with code search) is exactly what the "running app + declared meaning" scope rules out.

*If you'd rather decide not-yet or no instead of go, say so — the verdict is the thing on the table.*
