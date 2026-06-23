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
relatedTo: ["1634", "1651"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, navigation, jump-to-source, introspection, ai-generated, validation, decision]
---

# Jump-to-source from any live element

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether it earns a roadmap slot, not which of two designs wins.** The idea: click any rendered thing in the running app and open its **declaration** in the editor — whatever the stack. The differentiator from the existing click-to-component crowd is that resolution goes through the app's **declared model** (intent / component / provider / rule + owner), so it is standard-based and stack-agnostic rather than React/framework-bound. The decision is a **go / not-yet / no** validation gate, not a merit fork.

**Recommended verdict: go (build) — Confidence Medium.** Like semantic search, it reads over the introspection the app already exposes (the same "live element → declaration/owner" resolution the [explain-element inspector #1634](/backlog/1634-semantic-explain-this-element-inspector/) needs), so it needs no new capture substrate; the open-in-editor mechanism is well-trodden. The residual is the cross-stack source-mapping reliability, which scopes the build rather than blocks it.

## What you're deciding

Does Web Everything commit to **jump-to-source from any live element** as a dev-browser feature — and (since the verdict is go) confirm scope. Concretely it would:

- **Resolve a clicked element to its declaration** — via the declared model (which intent/component/provider/rule produced it), not a framework-internal handle.
- **Open in the editor** — deep-link to the declaring file:line in the user's editor, any stack.
- **Surface the owner** — alongside the source, who owns that declaration (the #142 ownership thread), so the jump self-routes.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer, or drop. Per the user directive that is still a `decision` card — here it resolves to **go**, because the substrate it needs already exists.

## Context & prior-art delta

The click-to-source category exists — the delta is *standard-based, stack-agnostic resolution via the declared model vs framework-specific component mapping*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Onlook** | Click the live UI → open its code | React-specific; maps to a React component, not a stack-agnostic **declared** node, no owner |
| **React DevTools "open in editor"** | Jump from a selected component to source | Bound to the React fiber tree; React-only, component-granular, no intent/rule/owner resolution |
| **vite-plugin-react click-to-component** | Alt-click an element → open its JSX | React + Vite only; resolves JSX source, not the app's declared intent/provider/rule model |
| **locatorjs** | Click any element → jump to its source | Supports a few frameworks via build instrumentation; framework-bound, no declared-model/owner layer |

The moat (per #142): a WE app is **self-describing**, so resolution is *semantic, portable, verifiable* — the clicked element maps through the declared model (intent/component/provider/rule + owner), which makes it stack-agnostic. That is exactly what the framework-specific click-to-source tools cannot offer without being tied to one runtime.

## Dependencies & lineage

- **No new capture substrate needed.** It reads over the introspectable declared model the app already exposes, so — like [#1651](/backlog/1651-semantic-search-over-the-running-app/) — it can go now while the capture-dependent siblings wait.
- **Shares a resolver with the explain-element inspector.** [#1634](/backlog/1634-semantic-explain-this-element-inspector/) ("explain this element" → intent/component/provider/rule/owner) needs the same "live element → declaration + owner" resolution; build one resolver both consume. Semantic search [#1651](/backlog/1651-semantic-search-over-the-running-app/) reuses it to locate hits.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat rule (resolution is in-browser; opening the editor is a local deep-link, no backend).

## Recommendation

- **Verdict: go (build), Confidence Medium.** It rides existing introspection, shares a resolver with #1634, and has a clean stack-agnostic delta. Confidence is Medium (not higher) because cross-stack source-mapping reliability is the one real engineering risk.
- **Concrete scope trigger:** open a build story now; build the shared "live element → declaration + owner" resolver first (also serving #1634 and #1651), validate the open-in-editor deep-link on a flagship exercise-app across at least two stacks before generalising.
- **Skeptic:** "locatorjs and React DevTools already do click-to-source — this is solved." *Refuted on the delta, not novelty:* every incumbent is framework-bound and resolves to *framework component source*; WE resolves through the **declared model** (intent/provider/rule + owner) and is therefore **stack-agnostic** — a thing a React-fiber or JSX-source mapper structurally cannot do. The residual the skeptic raises is **build reliability across stacks**, which the phased scope addresses — hence go, not a clone.

*If you'd rather decide not-yet or no instead of go, say so — the verdict is the thing on the table.*
