---
kind: story
size: 8
parent: "142"
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: a shared capture/introspection substrate exists (co-built #1631/#1646)"
priority: low
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1631", "1646", "2095"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, diff, change-safety, ai-generated, accepted-on-merit, dissolved]
---

# Branch and run diff in the dev browser

> **DISSOLVED → accepted on merit** (batch-confirmed per [#2095](/backlog/2095-apply-the-2092-merit-conceded-dissolve-test-to-the-ten-142-v/), applying the [#2092](/backlog/2092-validation-gate-not-yet-verdicts-vs-the-not-a-prioritization/) merit-conceded dissolve test). The merit is **conceded** — real (clean delta, on-moat) — so this is **no longer an open go/no/not-yet decision**; it is an accepted build gated on its trigger. **Trigger:** a shared capture/introspection substrate exists (co-built with #1631/#1646). Everything below is retained as the **settled** merit rationale (the concession), not an open question.

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether it earns a roadmap slot, not which of two designs wins.** The idea: load branch A and branch B of the app side-by-side in the dev browser and diff them across three layers at once — declared **state**, rendered **output**, and declared **rules** — so a reviewer sees "this branch drops a required field / changes a visibility rule / produces a different provider value," not merely "these pixels moved" or "these lines changed." It extends the design-diff idea to a full branch-vs-branch comparison. The decision is a **go / not-yet / no** validation gate, not a merit fork.

**Recommended verdict: not-yet — accept the candidate as real, gate the build on the shared capture substrate.** **Confidence: Medium.** The semantic three-layer diff is on-moat and the prior-art delta is clean; demand and the underlying capture artifact are the gates.

## What you're deciding

Does Web Everything commit to a **branch / run diff** as a dev-browser feature — and if so, on what trigger does it become a build? Concretely, the diff would compare two runs across:

- **Declared state** — provider/context values and shape (e.g. a required field added/removed, a context default changed).
- **Rendered output** — what actually renders, attributable to the state/rule change rather than reported as opaque pixels.
- **Declared rules** — conformance / visibility / validation rules in force, so a rule regression surfaces as a *rule* delta.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card — resolving to a **go/no/not-yet verdict**, not a winning branch. The real sub-question with tension is the **trigger** (build now vs gate on capture), handled below.

## Context & prior-art delta

The diff/regression category is mature — the delta is *semantic state+rules diff vs pixel-or-text diff*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Chromatic / Percy** | Branch-vs-branch visual regression in CI | A *pixel* diff of stories; "what changed" is image-space, never a **declared state or rule** delta |
| **git diff** | Authoritative text diff of two branches | Diffs *source lines*, not the **running app's** behaviour, declared state, or rule set |
| **Vercel / Netlify preview deploys** | Branch B side-by-side with prod for eyeballing | A deployed URL to look at by hand; no machine diff of state/render/rules, no attribution |
| **Reg-suit / BackstopJS** | Automated visual regression between builds | Screenshot diffing; opaque to *why* — no declared-rule or semantic-state model |

The moat (per #142): a WE app is **self-describing**, so the diff can be *semantic, portable, verifiable* — it attributes a rendered change to a declared state/rule delta. That three-layer, cause-attributed diff is exactly what pixel and text tools structurally cannot produce.

## Dependencies & lineage

- **Rides the shared capture substrate — build capture once.** #142 names the trace/replay + introspection artifact as a shared mechanism; this feature consumes it to snapshot each branch's state/render/rules, alongside [#1631](/backlog/1631-shareable-full-context-repro-bundle-for-the-dev-browser/) (repro bundle) and [#1646](/backlog/1646-scenario-and-fixture-library-that-doubles-as-e2e-fixtures/) (scenario library). Coordinate so capture/introspection is built once.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat rule (both branches run locally; no diffing backend to host).

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** The candidate is real (clean delta, on-moat), so don't drop it — but it depends on the not-yet-existing capture/introspection substrate, and demand is unproven.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the #142 capture/introspection artifact has shipped in some form, AND **(2)** a real review on a flagship exercise-app surfaces a *rule or declared-state* regression that pixel/text diffs missed — evidence the three-layer diff earns its keep.
- **Skeptic:** "Chromatic already diffs branches — this is a visual-regression clone." *Refuted on the delta, not novelty:* Chromatic diffs pixels and tells you nothing about *why*; the WE diff compares **declared state, render, and rules** and attributes the render change to its cause — which a screenshot diff cannot do without the declared model. The residual the skeptic is right about is **timing** — hence not-yet, not go.

## Vision enrichment — live mirrored dual-run (2026-06-23)

Beyond the static "snapshot A vs snapshot B" diff, the target experience is a **live mirrored dual-run**: both branches running simultaneously in the dev browser, every input event **fan-routed to both** instances, with **differential highlighters** lighting up divergence in real time across the three layers (declared state, rendered output, declared rules). This is the most vivid expression of the semantic-diff moat — and it raises the capture requirement from offline snapshot/replay to **live event-mirroring + dual concurrent render**. Parked at `priority: low`; recorded here so the framing isn't lost when the card un-gates.

*~~If you'd rather decide go now (open a build story immediately) or no (drop the candidate), say so — the verdict is the thing on the table.~~ (Superseded: dissolved to accepted-on-merit per #2095 — the verdict is settled, not open.)*
