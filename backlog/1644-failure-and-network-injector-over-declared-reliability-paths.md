---
kind: decision
parent: "142"
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: 1692
codifiedIn: one-off
preparedDate: "2026-06-23"
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, fault-injection, reliability, ai-generated, validation, decision]
---

# Failure and network injector over declared reliability paths

## Digest

This validates an AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/): a dev-browser control that exercises the app's *declared* reliability and error paths on purpose — fire the exact failures the app says it handles (retry, fallback, recovery handler, offline) and watch the live app take the declared path. The key difference from generic fault injection: the failures offered are **enumerated from the app's declared reliability contract** (webreliability), not a free-form "break a random request" panel. The decision is a one-sided go / no / not-yet validation gate, not a merit fork.

**Recommended verdict: not-yet — accept the candidate, gate the build on the webreliability substrate. Confidence: Medium.** The declared-path delta is real and on-moat, but it depends on webreliability's recovery-handler registry existing to enumerate paths against; until then it degrades to a generic injector with no WE advantage.

## What you're deciding

Whether Web Everything commits to a **failure / network injector** as a dev-browser feature, and on what trigger. Concretely the panel would:

- **Enumerate the app's declared reliability paths** from the webreliability contract — which operations declare retry/fallback/recovery semantics, and what error classes each handles.
- **Inject the matching failure live** — fail *this* declared operation with *that* declared error class (timeout, 5xx, offline, partial), so the dev triggers the precise path the app claims to handle, on demand.
- **Verify the declared path actually fired** — did the recovery handler run, did the fallback render, did the retry budget exhaust as declared? Surface mismatches between declared and observed reliability behavior.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "build shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card resolving to a **go / no / not-yet verdict**. The genuine sub-question is the **trigger** (does it ride webreliability), handled below.

## Context & prior-art delta

The category is mature; the delta is *driven by declared reliability paths* vs. generic fault injection:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Chrome DevTools network throttling / offline** | Toggle offline, throttle the network live | Coarse, app-agnostic — fails *everything*; no notion of which operations declare a recovery path |
| **MSW (Mock Service Worker)** | Intercept requests and return error responses | Author hand-writes each handler; not driven by the app's declared reliability contract, no path-fired verification |
| **Chaos Monkey / Gremlin** | Inject faults deliberately to test resilience | Infra/service-level chaos engineering, production-oriented; not a dev-time per-declared-path simulator in the browser |
| **Cypress `cy.intercept` / Playwright route** | Force a specific request to fail in a test | Per-test scripted stubbing; not a live, app-declared menu of failures with handler-fired assertions |

The moat (per #142): a WE app **declares** its reliability paths via webreliability, so the injector offers the *exact* failures the app claims to handle and verifies the declared handler fired — generic injectors fail blindly and can't tell whether a declared recovery path even exists, let alone whether it ran.

## Dependencies & lineage

- **Rides the webreliability substrate.** The "declared reliability paths" it enumerates are exactly the webreliability recovery-handler registry: contract types [#1051](/backlog/1051-webreliability-contract-recovery-handler-registry-types-in-w/), provider runtime [#1052](/backlog/1052-webreliability-provider-recovery-handler-registry-runtime-in/), and the [#1032](/backlog/1032-design-the-protocol-level-error-recovery-seam-for-webreliabi/) protocol seam. It cannot enumerate declared paths before that contract exists — this is the natural trigger.
- **Without webreliability it collapses to DevTools/MSW** — a generic injector with no WE delta. The declared-path enumeration is the whole point, so don't build the generic version first.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule.

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** The candidate is real and on-moat (clean delta vs. generic injectors), so don't drop it — but its entire advantage is reading webreliability's declared paths, which don't yet ship.
- **Un-gate trigger (concrete):** promote to a build story when the **webreliability recovery-handler registry has shipped** (contract #1051 + provider #1052, against the #1032 seam) AND a flagship exercise-app declares real reliability paths to enumerate — so the injector has actual declared paths to drive, not a generic fallback.
- **Skeptic:** "DevTools offline + MSW already let me test error states — this is redundant." *Refuted on the delta, not on novelty:* those inject failures *blindly* and the dev has to know which operations *should* recover; this offers only the failures the app **declares** it handles and asserts the declared recovery path actually fired — neither DevTools nor MSW can do that without the reliability contract underneath. The residual the skeptic is right about is **timing** — absent webreliability it really is just MSW — hence not-yet, not no.

*If you'd rather decide go now or no (drop the candidate), say so — the verdict is the thing on the table.*
