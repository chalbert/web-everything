---
kind: decision
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1642"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, contract-inspector, ai-generated, validation, decision]
---

# Live contract and data inspector at provider/context seams

## Digest

This AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) earns a go/not-yet/no validation gate, not a merit fork. The idea: at every provider/context seam in a running WE app, show the **actual data flowing through** side-by-side with the **declared contract** for that seam, and validate the live value against it in real time — green when the runtime payload conforms, red (with the offending path) when it drifts. Existing devtools show you the data; none of them hold it up against a *declared* schema the app itself ships. Because a WE app already carries that declared contract introspectably, the validation is almost free to read.

**Recommended verdict: not-yet — accept the candidate, gate the build on the introspection substrate.** Confidence: Medium. The prior-art delta is the cleanest in this cluster (live actual-vs-declared validation is genuinely absent from the market), but the inspector can't read seam contracts until the #142 introspectable-model surface exposes them.

## What you're deciding

Does Web Everything commit to a **live contract/data inspector at provider/context seams** as a dev-browser feature — and on what trigger does it become a build? Concretely it would, for each seam:

- **Show the declared contract** — the schema/shape the seam promises (from the app's own contract declarations, not inferred).
- **Show the actual payload** — the live value crossing the seam right now, snapshotable over time.
- **Validate live** — diff actual against declared continuously; surface the exact failing path/field when the runtime value violates the declared shape.
- **Locate the drift** — point at the provider/consumer responsible so a contract violation self-routes to an owner.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or here — no rival "shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card — "anything I want to decide" — resolving to a **go/no/not-yet verdict** rather than a winning branch. The genuine open sub-question is the **trigger** (build now vs gate on the introspection substrate), handled below.

## Context & prior art delta

The category — inspecting data at boundaries — is crowded; the delta is *live validation against a declared contract* vs *just displaying data*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Apollo Client DevTools** | Inspect cache + queries crossing the GraphQL boundary | Shows operation data; validates against the GraphQL schema only at the network boundary, not at in-app provider/context seams, and not as a continuous live conformance read |
| **Chrome DevTools Network tab** | Every request/response payload | Opaque bytes/JSON; no notion of a *declared* in-app contract to check against |
| **GraphiQL / GraphQL Playground** | Schema-aware query exploration | A query IDE against the server schema, not a live runtime inspector validating in-flight values at every component seam |
| **TanStack Query DevTools** | Live cache/query state in the running app | Shows query state and data; does not validate the payload against an app-declared contract per seam |
| **Zod / tRPC** | Schema validation of runtime data | Library-level validation in *code* you wrote; not a live cross-seam *inspector* surface over the whole running app |

The moat (per #142): a WE app is **self-describing**, so each seam's contract is introspectable — the inspector *reads* the declared shape and checks the live value against it. Validating actual-vs-declared continuously, across every seam, is precisely what none of the incumbents can do without that declared model underneath.

## Dependencies & lineage

- **Rides the introspectable-model substrate.** #142 names the introspectable registries/contexts as a shared mechanism; this inspector reads seam contracts + live values from it and can't ship before that surface exposes them — the natural trigger.
- **Adjacent:** [#1642](/backlog/1642-intent-and-a11y-conformance-inspector/) (intent/a11y conformance inspector) is the sibling conformance surface — both are "declared vs reality" inspectors; coordinate their panel model so the dev browser has one conformance lens, not two.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule (validation runs in-browser against the local declared model; no per-call backend).

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** The candidate is real with the cluster's cleanest prior-art delta — don't drop it — but don't open a build yet: it depends on the introspection surface exposing seam contracts + live values, which isn't there yet.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the #142 introspectable model exposes per-seam declared contracts and the live values crossing them, AND **(2)** a flagship exercise-app run hits a real contract-drift bug (runtime payload violating a declared shape) that the generic network/cache devtools failed to surface — evidence, not speculation.
- **Skeptic:** "Apollo DevTools + Zod already cover this." *Refuted on the delta, not on novelty:* Apollo validates only at the GraphQL network boundary and Zod validates in the code you hand-wrote — neither continuously holds the live value at *every in-app seam* against a contract the app *declares and ships*. The continuous actual-vs-declared read across all seams is the structural gap. The residual the skeptic is right about is **timing** — hence not-yet, not go.

*If you'd rather decide go now (open a build story immediately) or no (drop the candidate), say so — the verdict is the thing on the table.*
