---
kind: story
size: 5
parent: "142"
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: the ownership/persona roster is populated"
priority: low
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1637", "1639", "166", "564", "2095"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, ownership, routing, ai-generated, accepted-on-merit, dissolved]
---

# Ownership-aware routing in context

> **DISSOLVED → accepted on merit** (batch-confirmed per [#2095](/backlog/2095-apply-the-2092-merit-conceded-dissolve-test-to-the-ten-142-v/), applying the [#2092](/backlog/2092-validation-gate-not-yet-verdicts-vs-the-not-a-prioritization/) merit-conceded dissolve test). The merit is **conceded** — the ownership-model delta is real and on-moat (a clean delta, and a keystone the rest of the cluster routes through) — so this is **no longer an open go/no/not-yet decision**; it is an accepted build gated on its trigger. **Trigger:** the ownership/persona roster is populated, so a real owner model exists to route against. Everything below is retained as the **settled** merit rationale (the concession), not an open question.

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether the idea earns a roadmap slot, not which of two designs wins.** The idea: for the component / rule / state you're looking at in the dev browser, the app already knows *who owns it* — so a bug, a PR review request, or a question auto-routes to the right person instead of landing in a shared triage queue. This is the keystone of the #142 "best person does the work" thread: routing keyed to **semantic** ownership of a declared piece, not to file paths or commit authorship.

**Recommended verdict: not-yet — accept the candidate as real, gate the build on a concrete trigger.** **Confidence: Medium-high.** The prior-art delta is clean and this is upstream of #1637/#1639, but the ownership *model* it routes on (per-component/rule owner metadata) has to exist and be populated first.

## What you're deciding

Does Web Everything commit to **ownership-aware routing in context** as a dev-browser feature, and on what trigger does it become a build? Concretely:

- **Owner resolution at the semantic node** — given the component / declared rule / state / intent under the cursor, resolve its owner from the introspectable model (the same self-describing registry the rest of #142 rides), not from `git blame` or a directory map.
- **Route, don't queue** — turn "this is broken / needs review / has a question" into a directed hand-off to that owner (file the bug at them, request their review, ping them), so triage isn't a human dispatch step.
- **Roster source** — owners come from a persona/ownership roster ([#166](/backlog/166-governance-persona-roster-charter-schema/) governance persona roster, [#564](/backlog/564-personas-as-a-first-class-agile-concept/) personas first-class), so "owner" is a modeled role, not a free-text name.

## Why this isn't a classic fork (and is still a decision)

There's no contested either/or — no rival "build shape A vs shape B" where one branch is flawed (the *fork-existence* test). It's a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card — "anything I want to decide" — resolving to a **go / no / not-yet verdict**, not a winning branch. The genuine sub-question with real tension is the **trigger**: the ownership model has to be populated before routing has anything to route on.

## Context & prior art delta

The category is mature — the delta is *semantic-node ownership vs file/commit/heuristic ownership*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **GitHub CODEOWNERS** | Declares owners and auto-requests their review | Owns by **glob/file path**, not by the component / rule / state a person actually owns; can't route from the running UI |
| **Sentry suspect-commits / ownership rules** | Maps an error back to a likely owner | Heuristic — last-toucher / stack-frame path matching; no model of *semantic* ownership of a declared piece |
| **`git blame`** | Who last edited these lines | Authorship ≠ ownership; line-level, no notion of the component/rule as an owned unit |
| **PagerDuty / Opsgenie routing** | Routes incidents to an on-call owner | Service/schedule-keyed at the infra layer; nothing ties it to a UI component, declared rule, or app state |

The moat (per #142): a WE app is **self-describing and knows who owns each piece**, so routing keys off *semantic* ownership of a declared node — a thing none of the incumbents can do, because they own by file, commit, or service, never by component/rule/state.

## Dependencies & lineage

- **Needs the ownership model first.** Routing is only as good as the owner-of-each-node data. Source it from the persona/ownership roster — [#166](/backlog/166-governance-persona-roster-charter-schema/) (persona roster + charter schema) and [#564](/backlog/564-personas-as-a-first-class-agile-concept/) (personas first-class). That model existing + populated is the natural trigger.
- **Upstream of [#1637](/backlog/1637-capability-matched-task-queue/)** (capability-matched task queue) — the queue *extends* this routing into a prioritised, expertise-matched work feed. Decide this first; #1637 builds on its owner-resolution.
- **Feeds [#1639](/backlog/1639-semantic-handoff-packets-between-roles/)** (semantic handoff packets) — a handoff packet carries the owner of each node it bundles; this resolver is how it knows.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule.

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium-high.** The candidate is real and on-moat (clean delta, keystone of the ownership thread), so don't drop it — but don't open a build yet: it has no owner-of-each-node model to route on until the persona/ownership roster is populated.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the persona/ownership roster (#166/#564) is populated with per-node ownership for at least one flagship app, **AND (2)** a real exercise-app run produces a bug/review that a triage queue demonstrably mis-routes (evidence the auto-route would have helped).
- **Skeptic:** "CODEOWNERS + Sentry suspect-commits already auto-route — this is reinventing routing." *Refuted on the delta, not on novelty:* both route by **file/commit heuristic**; neither can answer "who owns *this declared rule* / *this component instance* / *this state*" because they have no semantic model of the piece. WE owns by semantic node — that's exactly what makes the route correct from inside the running app, and what they structurally can't emit. The residual the skeptic is right about is **readiness** (no model to route on yet) — hence not-yet, not go.

*~~If you'd rather decide go now (open a build story) or no (drop it), say so — the verdict is the thing on the table.~~ (Superseded: dissolved to accepted-on-merit per #2095 — the verdict is settled, not open.)*
