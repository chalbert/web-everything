---
type: idea
workItem: story
size: 5
parent: "089"
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: webcases/generateCase.ts (AI-proposes→standard-verifies→compile conformance-case generator; @webeverything/webcases export)
tags: []
---

# Conformance-case generator (AI proposes, standard verifies)

Generate webcases source-of-truth from a natural-language description, feeding docs + tests + conformance badge. The leftover uncarved twin of the resolved #086/#094/#095/#096 AI-proposes/standard-verifies siblings. Unblocked build — the webcases suite exists.

## Progress

- **Resolved 2026-06-17.** Built `webcases/generateCase.ts` — the AI-proposes front-end that
  `compileRequirement.ts` explicitly defers to (*"requirements that don't ground are the AI
  test-generator's domain, a Plateau-served provider, #475 no-leakage"*). `generateCase(nl, { propose,
  registries, maxAttempts })` runs the loop: a NL description → a candidate `RequirementRecord` from an
  **injected** proposer → the deterministic `validateRequirement` (slice A #100) grounds it → only a
  grounded record is projected to webcase(s) by `compileRequirement` (slice B #797). Exported from the
  `@webeverything/webcases` package.
- **Fidelity to the pattern:** the AI never lives here — `RequirementProposer` is an injected seam (no
  imported SDK; #475 no-leakage). The **deterministic validator is the authority** (the #095 autofix
  precedent): an ungrounded proposal is **rejected, not trusted**, and never compiled. The verifier's
  slot-pointed findings are fed back to the proposer for a bounded retry, so grounding *steers*
  generation. `heuristicProposer` is a dependency-free offline fallback (not the AI) that grounds a
  description naming real registry ids — for the demo + tests.
- **Tested:** pure orchestration over injected pieces — 9-case offline suite
  (`webcases/__tests__/generateCase.test.ts`, green): compiles-when-grounded, rejects-and-never-compiles
  the ungrounded, findings-steer-the-retry, stops-after-maxAttempts, awaits an async (Plateau) proposer,
  and the heuristic-proposer end-to-end ground+compile.
