---
kind: epic
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-13"
graduatedTo: project:webcompliance
tags: [project, webcompliance, conformance, governance, policy-as-code, gating, audit]
crossRef: { url: /backlog/350-web-reporting-project/, label: "Web Reporting (#350)" }
---

# Web Compliance — promoting conformance measures to enforced hard rules

A candidate WE **project** (`webcompliance`) for the **enforcement** layer, deliberately separated from
**conformance**. The distinction (settled 2026-06-12):

- **Conformance** = *how aligned* something is to a standard — a **measure** on a spectrum (the
  `check:app-conformance` benchmark, conformance demos, `conformanceLevel`). It reports, it doesn't block.
- **Compliance** = a conformance criterion **promoted to an enforced hard rule** — a gate, with severity,
  pass/fail, waivers, and an audit trail (the Sonar / lint / audit register). A team *chooses* to move a
  conformance measure into a hard rule; from then on it is reported as compliance.

Web Compliance owns that promotion path and the machinery around it. The benchmark's `--strict` flag is
the seed of this layer; the project generalizes it.

## The pipeline (each phase → one or more child stories)

| Phase | Produces | Notes |
|---|---|---|
| **1 · Policy / rule model** | which conformance criteria are enforced, at what **severity**, for which scope — policy-as-code, versioned, **extends a platform-default policy** | The canonical artifact; natural first slice. Defaults live in a project config that extends the platform default — a platform-default baseline policy + a per-project extension. |
| **2 · Gates** | runners that fail CI / block on a policy violation — the escalation of a conformance score to a hard rule | Generalizes the benchmark's `--strict` seed into a declared, severity-aware gate. |
| **3 · Waivers / exceptions** | tracked, **expiring**, audited overrides | Makes a gate governable, not brittle. |
| **4 · Audit / evidence trail** | what was enforced, when, against which standard version, with what result — the defensible record | Mirrors the loan app's proof-of-compliance at the platform level. **Emits through Web Reporting ([#350]) — an audit result is just another report source.** |
| **5 · Retrofit existing gates** | `check:standards` + the readiness gates re-expressed as **declared policies** rather than hardcoded scripts | They are *already* compliance (hard CI gates) — fold them in as the seed policy set. |

## Design tensions (leanings, not yet settled)

- **Project + Protocol, or project + intent?** The interop question splits cleanly: compliance's *results*
  (audit/evidence) ride **#350's** report protocol, so Compliance needs no report protocol of its own. A
  separate *policy/gate* interchange story (exchange a policy set across vendors — OPA/Rego, Sonar quality
  gates) is speculative. **Leaning: a Project + a policy model (config), no compliance-specific protocol in
  v1** — emit through #350, and add a policy-interchange protocol only if a concrete cross-vendor need
  appears.
- **Are `check:standards` / readiness already compliance?** **Yes** — they're hard CI gates today, the
  first compliance policies, hardcoded. **Leaning: unify them here (phase 5)** — re-express each as a
  declared, severity-tagged policy extending the platform default, so the gate set is *data*, not scattered
  scripts.
- **Per-project policy extends a platform default?** **Yes** — consistent with every other WE config layer
 : a fully-defined platform-default policy (the baseline
  gates) + a project policy that extends/overrides it.

## Relationships

- Builds **on** conformance (the measure) — never replaces it; a rule is a conformance signal with teeth.
- Emits through **Web Reporting** ([#350]) — audit/gate results are just another report source.
- The exercise-app benchmark is the first producer of
  conformance signals a compliance policy could promote.

## Why an epic (storied) — sliced 2026-06-12

Five independently-deliverable phases, now carved into child stories (points live on the children):

- **#436** policy/rule model (extends a platform-default policy) — root, no blockers (the first slice).
- **#437** compliance gates (CI runners that block on a violation) — `blockedBy 436`.
- **#438** waivers / exceptions (expiring, audited overrides) — `blockedBy 436, 437`.
- **#439** audit / evidence trail (emits through Web Reporting) — `blockedBy 436, 437, 431` (the
  cross-epic edge: it consumes #350's report model).
- **#440** retrofit `check:standards` + readiness gates as declared policies — `blockedBy 436, 437`.

#436 is workable first; the gates and audit trail build on it.

## Resolved 2026-06-13 — decomposition complete

All five phase children have landed (`status: resolved`): #436 (policy/rule model), #437 (gates),
#438 (waivers), #439 (audit/evidence trail, emitting through #350), #440 (retrofit
`check:standards` + readiness as declared policies). The epic graduated to the **`webcompliance`**
project entity (`project:webcompliance` in `we:projects.json`). Nothing further is owned at the epic
level — future work attaches to the project, not here.
