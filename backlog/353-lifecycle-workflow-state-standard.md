---
type: idea
workItem: story
size: 8
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "project:weblifecycle"
tags: [candidate-standard, exercise-app-discovery, lifecycle, workflow, state-machine]
crossRef: { url: /backlog/314-flagship-exercise-apps/, label: "Surfaced by exercise-app work (#314)" }
---

> **Resolved 2026-06-12 — codified.** Graduated to the **Web Lifecycle** project (`weblifecycle`,
> `projects.json`) owning the **Lifecycle** protocol (`lifecycle`, `protocols.json`, draft;
> normative body in `src/_includes/project-weblifecycle.njk` §`protocol-lifecycle`). The contract:
> declarative status set + transition map (`from→to` + guard + actor), a `CustomLifecycleProvider`
> registry, and an observable transition event. Authorization is delegated to Web Guards; the event is
> the composition seam for audit ([#357]). The runtime block that makes the loan app *conformant* is
> the follow-up [#391]. The visual half is the `status-indicator` intent ([#354], also resolved).

# Candidate standard — Lifecycle / workflow-state (domain entity status machine)

Missing standard surfaced building the loan-origination app ([#317](/backlog/317-exercise-app-loan-origination/)).
The application moves through a **guarded lifecycle** — `draft → submitted → processing → underwriting →
approved-with-conditions → clear-to-close | declined` — with **role-scoped transitions** and per-state
permissions. WE has `webstates` (reactive state *primitives*) but **nothing for a domain entity's
lifecycle**: a declared status set, allowed transitions + guards, and a canonical status
visualization/announcement. Every LOB app needs it (insurance policy lifecycle, claim, order, ticket),
so it is the **most universal** gap the program found.

## What a standard would cover

- A declarative **status set + transition map** (allowed `from→to`, guard predicates, the actor/role permitted).
- Canonical **status display** (the current state, available next actions) + a11y announcement of transitions.
- Composition with permissions (state-scoped edit) and audit (every transition logged — see [#357]).

## Relations & open questions

- vs `webstates` (reactive primitives) — this is *domain workflow* state, a layer above. Project + Protocol, or an intent?
- Overlaps the evergreen-app vision (#099) and permissions (#009). Borrow vocabulary from XState/statecharts? (research)
