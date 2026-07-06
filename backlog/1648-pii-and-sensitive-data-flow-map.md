---
kind: decision
parent: "142"
status: open
priority: low
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1632", "2095"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, privacy, pii, data-flow, ai-generated, validation, decision]
---

# PII and sensitive-data flow map

> **KEPT as a validation gate — reshaped per [#2095](/backlog/2095-apply-the-2092-merit-conceded-dissolve-test-to-the-ten-142-v/) (the [#2092](/backlog/2092-validation-gate-not-yet-verdicts-vs-the-not-a-prioritization/) dissolve test).** Unlike its ten #142 siblings, this candidate's merit is **conditional, not conceded**, so it does *not* dissolve — it stays a live go/no/not-yet call. The gate leads with the merit unknown below.

## The decision — does the declared state model carry the facets to derive from?

**This is the one thing being decided.** The whole moat ("derive the map from the app's *declared* state/seam model, not a heuristic scan") is real **only if** the declared state model actually classifies each state node with **visibility** (private/shared), **persistence** (written to storage), and **egress** (sent to a network destination) facets. If it does not, this feature is a heuristic scanner with **no WE advantage** — and the real prerequisite is *that classification*, which may not exist today (the webstates state model — [#1089](/backlog/1089-webstates-completion-change-tracking-storage-protocols-recon/) family, persistence facet [#1106](/backlog/1106-webstates-storage-contract-types-storagepersistence/)) does not obviously carry them yet.

So the ratify question is, in order:

1. **Do the declared state facets exist (or are they specced)?** No → the decision is *not this feature yet*; file the **facet classification** as the real prerequisite and gate on it. Yes → continue.
2. **Given the facets, is the derive-from-declared delta worth building** over #1632's seam model, and on what demand trigger? (the not-yet gate below).

The rest of this card (digest, prior-art, dependencies) is the **merit case** for step 2; step 1 is the gate that must clear first.

## Digest

This validates an AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/): a dev-browser map of where each piece of state is private vs. shared, whether it is persisted, and where it is sent — the introspectable state model applied to privacy and compliance. The difference from DLP scanners and data maps: it derives from the app's **own declared state and seam model** (which state crosses which provider/context boundary, what persists, what egresses), not from a heuristic scan or a hand-maintained spreadsheet. The decision is a one-sided go / no / not-yet validation gate, not a merit fork.

**Recommended verdict: not-yet — accept the candidate, gate on the declared state-visibility/seam substrate. Confidence: Medium-Low.** The derive-from-declared-model delta is on-moat, but it needs the state model to actually *carry* visibility/persistence/egress facets to derive from; absent that classification it's a heuristic scanner with no WE advantage, and demand is the least proven in the family.

## What you're deciding

Whether Web Everything commits to a **PII / sensitive-data flow map** as a dev-browser feature, and on what trigger. Concretely it would:

- **Classify each declared state node** — private (component-local), shared (crosses a provider/context seam), persisted (written to storage), or sent (egresses to a network destination) — derived from the declared state + seam model.
- **Render the flow map** — a visual of which state crosses which boundary and ends up where, so a dev sees at a glance that, say, an email field is shared across three contexts and persisted to localStorage.
- **Flag policy violations** — state declared sensitive that crosses a boundary it shouldn't (persisted PII, PII sent to a third-party destination), so a privacy gap surfaces in-app rather than in an audit.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "build shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card resolving to a **go / no / not-yet verdict**. The genuine sub-questions are the **trigger** and whether the declared model even carries the needed facets, handled below.

## Context & prior-art delta

The category is large and enterprise-heavy; the delta is *derived from the app's declared state/seam model* vs. heuristic scanning:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **BigID / Transcend (data-flow & DLP scanners)** | Discover where PII lives and flows | Heuristic discovery over data stores/traffic; not derived from the app's *declared* state model, not an in-app dev-time view |
| **OneTrust (data mapping)** | Maintain a data-inventory / flow map | Largely manual/survey-driven GRC artifact; goes stale, no live tie to the running app's actual state |
| **Manual data maps / RoPA spreadsheets** | Document state → destination | Hand-maintained, drifts immediately from the code; zero introspection |
| **Static taint analysis (CodeQL flow queries)** | Trace tainted data through code paths | Build-time, code-graph based; not a live map of the running app's declared state crossing declared seams |

The moat (per #142): a WE app's state is **declared and crosses introspectable seams**, so the map is *derived* from the real declared model — what's shared, persisted, and sent is a property of the declared state + provider/context seams, not a guess. None of the incumbents can derive a current, accurate map without that declared model; they scan, survey, or drift.

## Dependencies & lineage

- **Needs the declared state model to carry visibility/persistence/egress facets.** The state nodes are the webstates declared state ([#1089](/backlog/1089-webstates-completion-change-tracking-storage-protocols-recon/) family; persistence facet [#1106](/backlog/1106-webstates-storage-contract-types-storagepersistence/)). The map can only derive "private/shared/persisted/sent" if the model *classifies* state with those facets — that classification is the real prerequisite, and may itself be unspecified today.
- **Builds on the seam introspection of [#1632](/backlog/1632-live-contract-and-data-inspector-at-provider-context-seams/)** (live contract/data inspector at provider/context seams) — the "which state crosses which seam" half is exactly what #1632 sees. This is #1632's data viewed through a privacy/compliance lens; decide #1632 first so this reuses its seam model rather than rebuilding it.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule.

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium-Low.** The candidate is on-moat (derive-from-declared vs. scan), so don't drop it — but it depends on the declared state model carrying visibility/persistence/egress facets that may not exist yet, it overlaps #1632's seam model, and dev-time demand for an in-app privacy map is the least proven in this family.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the declared state model classifies state with visibility/persistence/egress facets to derive from (else file that classification as the real prerequisite), AND **(2)** [#1632](/backlog/1632-live-contract-and-data-inspector-at-provider-context-seams/) has landed a seam model this can lens, AND **(3)** a flagship exercise-app surfaces a real compliance/PII need (e.g. the banking or identity app), not speculative demand.
- **Skeptic:** "BigID / OneTrust already do data-flow mapping at enterprise scale — WE shouldn't compete with GRC tooling." *Refuted on the delta, not on novelty:* those *scan or survey* and drift from the running code; this *derives* the map from the app's declared state + seams, so it's current and accurate by construction and lives where the dev works — a thing GRC scanners structurally cannot do without the declared model. The residual the skeptic is right about is **scope and demand** — full compliance tooling is out of scope and the need is unproven — hence not-yet (and only if the model carries the facets), not go.

*If you'd rather decide go now or no (drop the candidate), say so — the verdict is the thing on the table.*
