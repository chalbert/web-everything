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
relatedTo: ["1652", "1632"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, explain-element, introspection, ai-generated, validation, decision]
---

# Semantic explain-this-element inspector

## Digest

AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — a go/not-yet/no validation gate, not a merit fork, and the cluster's **closest to a clean go** (read-only over data the app already declares). The idea: click any rendered thing and the dev browser reveals its **meaning** — the intent it serves, the component/block it is, the provider feeding it, the rules in force, and who owns it. Inspect-element shows the DOM; React DevTools the component tree; neither shows meaning. WE has all of it introspectable, so the inspector is mostly a presentation layer.

**Recommended verdict: not-yet, leaning go — accept the candidate and gate only lightly.** Confidence: Medium-High. The prior-art delta is decisive and the dependency is the thinnest in the cluster (it reads, it doesn't capture/correlate), so the gate is mostly "the introspectable surface exposes intent/owner/rule per element," after which this is a strong early build.

## What you're deciding

Does Web Everything commit to a **semantic explain-this-element inspector** as a dev-browser feature — and on what (light) trigger does it become a build? Concretely, clicking any live element would reveal:

- **Intent** — the declared UX intent the element serves (density/role/purpose), not just its tag.
- **Component / block** — the WE component or block it is an instance of.
- **Provider / context** — which provider/context feeds its data and configuration.
- **Declared rules** — the conformance/visibility/validation rules in force on it.
- **Owner** — who owns the component/rule/state behind it (the #142 "best person does the work" thread), so a question about it self-routes.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card, resolving to a **go/no/not-yet verdict** rather than a winning branch. The only real open sub-question is how *light* the trigger should be — this is the candidate whose dependency is thinnest, so go-now is genuinely on the table.

## Context & prior art delta

The category — point at a thing, see what it is — exists everywhere; the delta is *meaning* vs *structure*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Browser inspect-element (DevTools Elements)** | Click an element → see its node, styles, box model | DOM/CSS structure only; zero semantic layer — no intent, rule, provider, or owner |
| **React DevTools (component tree)** | Click → see the React component, its props/state | The component *tree* and props, but not the declared intent it serves, the rules on it, or who owns it; React-only |
| **Storybook** | Browse components in isolation with controls/docs | A catalog of components out of context; not an in-situ "what is this *running* element and what does it mean" lens |
| **Vue DevTools (component inspector)** | Click → inspect the Vue component instance | Same as React DevTools — framework component view, no semantic/intent/owner model |

The moat (per #142): a WE app is **self-describing**, so intent, rule, provider, and owner are all introspectable per element. Revealing the *meaning* behind a rendered thing — not its DOM or its framework component — is exactly what every structure-only inspector cannot do without the declared model underneath.

## Dependencies & lineage

- **Rides the introspection substrate, but only as a reader.** #142 names the introspectable model; this inspector *reads* intent/component/provider/rule/owner per element — it doesn't need the trace or capture artifacts, which is why its dependency is the cluster's thinnest.
- **Adjacent:** [#1652](/backlog/1652-jump-to-source-from-any-live-element/) (jump-to-source from any live element) is the natural companion action — once you've explained an element, "open its source" is the next click; share the element-resolution layer. [#1632](/backlog/1632-live-contract-and-data-inspector-at-provider-context-seams/) (contract/data inspector) overlaps on the provider/context revelation; coordinate so the seam detail and the element detail are one model.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule (it reads the local declared model in-browser; no backend).

## Recommendation

- **Verdict: not-yet leaning go (accept, gate lightly), Confidence Medium-High.** The prior-art delta is decisive and the dependency is read-only — this is the cluster's strongest early-build candidate. The only reason it isn't a flat go is the introspectable surface must first expose intent/owner/rule per element.
- **Un-gate trigger (concrete, deliberately light):** promote to a build story as soon as the #142 introspectable model exposes intent + component + provider + declared-rule + owner addressable per rendered element. No second "demand" condition is required — a self-describing app makes this immediately useful, so this is the one to build first once the surface exists.
- **Skeptic:** "Inspect-element and React DevTools already let me click and see what something is." *Refuted on the delta, not on novelty:* those reveal DOM structure or a framework component tree — never the *meaning* (intent, rule, provider, owner) that determines why the element is there and who answers for it. That semantic layer is the whole point and is structurally absent from every incumbent. The residual is only that the introspectable surface must expose it — hence not-yet leaning go, not a flat go.

*If you'd rather decide go now (open a build story immediately) or no (drop the candidate), say so — the verdict is the thing on the table.*
