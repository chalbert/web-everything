---
kind: decision
parent: "1294"
status: open
priority: low
dateOpened: "2026-07-06"
preparedDate: "2026-07-09"
relatedReport: reports/2026-07-09-webtraits-webcases-placement-cascade.md
tags: [constellation-placement, relocation, webcases, no-leakage, decision]
---

# webcases generateCase placement — WE authoring loop or Plateau generation product

## Context

`we:webcases/generateCase.ts` drives an AI propose→verify→compile loop over an **injected** `RequirementProposer`
(a Plateau-served provider, #475). Decide whether the loop harness is a WE authoring tool (stays, injected seam)
or a Plateau generation feature (relocates). Parked; blocks nothing live.

> **Prep note (2026-07-09, `/prepare all`).** Grounded by research topic
> [`webtraits-webcases-placement-cascade`](/research/webtraits-webcases-placement-cascade/) (report
> [we:reports/2026-07-09-webtraits-webcases-placement-cascade.md](../reports/2026-07-09-webtraits-webcases-placement-cascade.md)).
> A fresh-context two-confusion screen found the injected seam **erases every merit axis** between the two
> homes, so this is **not a genuine fork** — it **dissolves to a contract-derived ratify: stays WE.** The one
> real residue is a build task (relocate `heuristicProposer`), carved below — not a fork. This card is prepared
> as a near-instant ratify.

## Grounding digest

- **The AI capability is externalized — `generateCase` is a #475 no-leakage client.** The proposer is an
  injected seam `RequirementProposer` (`we:webcases/generateCase.ts:37`, called at
  `we:webcases/generateCase.ts:80`); the module imports **no** AI SDK. `{#no-leakage-client}`
  (`we:docs/agent/platform-decisions.md:701-706`): AI inference is *never a WE standard* — it is a Plateau
  service the WE project consumes as a no-leakage client, and the WE corpus pipeline (#475+#396) is explicitly
  a *client that stays WE*.
- **The artifact-producer is WE-deterministic, not the AI.** The AI proposes only a *candidate*
  `RequirementRecord`; the deterministic `validateRequirement` (#100, WE) grounds it, and only a grounded record
  is turned into webcases by the deterministic `compileRequirement` (#797, WE)
  (`we:webcases/generateCase.ts:81-87`). So WE deterministic code produces the artifact; the AI is a no-leakage
  oracle whose *output* WE consumes — the #095 "AI proposes, the suite verifies" precedent.
- **The screen erased the merit axes.** With both homes free-to-build and instantly maintained: correctness is
  identical, dependency-direction is clean both ways (WE→WE-internal, or Plateau→WE), lock-in is zero, and no AI
  dependency leaks either way. Nothing separates "loop stays WE" from "loop → Plateau" except placement taste —
  the injected seam already neutralized the only real boundary concern (WE hosting the AI).
- **The one genuine defect — `heuristicProposer` in the production module.** `heuristicProposer`
  (`we:webcases/generateCase.ts:103`) is a concrete `RequirementProposer` implementation **shipped and exported
  from the WE production module**, consumed only by `we:webcases/__tests__/generateCase.test.ts` (verified: no
  production caller). It is a #1282 zero-impl nick and blurs the injected-only seam the module's own docstring
  is at pains to keep clean.

## Axis-framing

The nominal axis is "WE authoring tool vs Plateau generation product," but running the fork-existence test
**dissolves it**: the *flawed* branch (WE hosts the AI) does not exist — the capability is injected out — and
once it is out, the two remaining homes are merit-identical (the screen result). There is **no coherent
either/or**, so per the standing test this is a **contract-derived classification, not a fork**: #475 keeps the
*capability* out (honored by the seam) and keeps the output-consuming *client* in WE. The residual — a
proposer-impl mis-shipped from the WE module — is a **build task**, not a placement fork. Which layer:
**standard-layer (stays WE)** as a #475 no-leakage client. The ruling turns on a **code-level shape** (the
injected seam), so it carries a concrete code example.

## Recommended path at a glance

| Fork | Question | Recommended default (post-screen) | Main alternative (excluded) |
| --- | --- | --- | --- |
| 1 | Is `generateCase`'s loop a WE authoring tool or a Plateau product? | **(a) Stays WE — a #475 no-leakage client. Not a genuine fork: the injected seam erases the merit difference; ratify as a classification.** Plus a carved build residue: relocate `heuristicProposer` out of the WE production module. | **(b) Relocate the whole loop to Plateau** (dissolved — no merit difference once the AI is injected out; would move the deterministic WE validate+compile pipeline to Plateau against #475's client-stays-WE rule) |

## Fork 1 — WE authoring tool vs Plateau product (dissolved to a ratify)

**Not a genuine fork** (standing test): the branch that *would* make it one — WE hosting the AI capability —
does not exist, because the proposer is injected (`we:webcases/generateCase.ts:37`) and no SDK is imported. Once
the capability is out, the two homes are merit-identical (correctness, dependency-direction, lock-in all tie —
the screen result), so there is no coherent either/or to rule on. The honest shape is a **contract-derived
ruling**, not a pick between competing merits.

- **(a) Stays WE — #475 no-leakage client (default / ruling).** `generateCase` orchestrates two WE-owned
  deterministic pieces (`validateRequirement` #100, `compileRequirement` #797) over an injected proposer whose
  *output* WE consumes. This is exactly the shape #475 keeps in WE (the corpus pipeline is a client that stays
  WE) and the #095 propose/verify precedent. The Plateau *product* is the wiring of a *real* proposer + any
  generation UI — which lives outside this core, at the injection site.
- **(b) Relocate the whole loop to Plateau (dissolved).** Treat the propose→verify→compile loop as the
  "generate conformance cases" product. **Dissolved** — once the AI is injected out, moving the loop also moves
  the *deterministic WE validate+compile* pipeline to Plateau, against `{#no-leakage-client}`'s explicit
  "client stays WE," and buys no merit (the screen found none). The generation *product* is the injection-site
  wiring, not this pure orchestrator.

Injected-seam shape under the ruling (keyed to the real module — the seam that keeps the capability out):

```ts
// WE holds the loop + the seam INTERFACE + a deterministic fallback — no AI SDK imported:
export interface RequirementProposer {
  (nl: string, ctx: { registries: RequirementRegistries; previousFindings: readonly RequirementFinding[] })
    : Promise<RequirementRecord> | RequirementRecord;   // injected; NEVER an imported SDK
}
export async function generateCase(nl: string, { propose, registries, maxAttempts = 3 }): Promise<GenerateResult> {
  // propose (injected Plateau provider) → validateRequirement (#100, WE, deterministic) →
  // compileRequirement (#797, WE, deterministic).  Only a GROUNDED record compiles.
}

// The real run wires the Plateau proposer AT THE INJECTION SITE (outside this core, the Plateau product):
//   generateCase(nl, { propose: plateauRequirementProposer, registries })   // ← Plateau lives here, not in WE

// RESIDUE (build task, not a fork): heuristicProposer is a proposer IMPL exported from this WE module,
// consumed only by tests → relocate to the test fixture (or a FUI offline-demo module) to keep the seam clean.
```

**Skeptic:** SURVIVES-WITH-AMENDMENT (hostile refutation, all four axes). **(0) Classification:** correctly
filed under #475 (AI-authoring), not #1566 (a *conformance* run drives an impl-under-test; this drives an AI
oracle to author a spec) — the re-route to #1566 does not reach it. **(1) Merit:** the core survives — the
AI's output is not the artifact; the deterministic WE `validateRequirement`/`compileRequirement` produce it
(`we:webcases/generateCase.ts:81-87`), so WE hosts no capability. **(2/3) Overlap / citation-scope:** none —
#1566/#1771 don't reach an authoring loop over an already-Plateau-placed injected provider; #475 governs and is
honored. **Amendment (the genuine nick):** `heuristicProposer` (`we:webcases/generateCase.ts:103`) is a
WE-resident proposer impl (test-only consumer) → relocate it out of the production module. **Screen:**
FLAGGED(prio) → dissolved. The fresh-context two-confusion screen found (1) contract-visible but (2)
**no merit axis survives** once the injected seam is accounted for (correctness identical, dependency-direction
clean both ways, zero lock-in) — a placement preference in fork costume. Fix applied: dissolved to the
contract-derived ruling (a) + the separately-prioritized `heuristicProposer` build residue.

## Downstream

Ratifying (a): record "generateCase stays WE — #475 no-leakage client (loop + injected seam + deterministic
validate/compile)" in `we:docs/agent/platform-decisions.md` (a #475 corollary; the Plateau product is the
injection-site wiring). **File the carved build residue** as a #1294-child slice: relocate `heuristicProposer`
from `we:webcases/generateCase.ts` to `we:webcases/__tests__/` (or a FUI offline-demo module), leaving the WE
production module with only the loop + the `RequirementProposer` seam interface. No cascade beyond that one
move.

---

Cluster 1 of the #1294 relocation epic; sibling of #2298 / #2299. Prep research:
[we:reports/2026-07-09-webtraits-webcases-placement-cascade.md](../reports/2026-07-09-webtraits-webcases-placement-cascade.md);
research topic [`webtraits-webcases-placement-cascade`](/research/webtraits-webcases-placement-cascade/).
