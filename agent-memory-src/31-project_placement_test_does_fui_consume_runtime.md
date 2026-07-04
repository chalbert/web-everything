---
name: project_placement_test_does_fui_consume_runtime
description: "WE/FUI placement — runtime stays WE only if a WE-side check.ts gate consumes it over WE's OWN declarative data (#1566 bound), else→FUI; the conformance verifier IMPL + run are a Plateau product, WE keeps only the contract (interface+vectors+schema)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8b8ebd79-27de-47c5-8fcd-417d7f6d0b86
---

#817 ruling (B1, ratified 2026-06-17) sharpened the #730 define-vs-deliver axis into an operative
placement test for the WE/FUI boundary: **for a mixed contract+runtime plane, the cut is the
`contract.ts` file seam — only the contract (compile-erased types/interfaces) stays WE; ALL runtime
(error classes, `assert*` guards, constant data, native-default strategy classes, registry classes,
stateful engines) + impl-coupled `__tests__` → FUI. "No implementation stays in WE."**

The discriminator that decides a borderline runtime symbol (esp. an `assert*` guard): **does FUI
consume it at runtime, with no WE-side conformance gate consuming it instead?**
- An `assert*` stays WE ONLY if a WE-side build gate (`capability-manifest/check.ts`) consumes it —
  that gate is executable conformance *spec*. That's why #730 kept capability-manifest whole.
- The guard/validity-merge/validator-resolution planes have NO `check.ts`; their `assert*` runs in the
  in-app delivery engine's hot path (`ValiditySourceOrchestrator.merged()` calls `assertMergedValidity`),
  so even the asserts → FUI. Native-first protects the default *policy/precedence* (documented in the
  contract), NOT the executable const/class (ships with impl — cf. #730 sent native-first `nativeHtml.ts`
  to FUI).

Caught by a ratify-time skeptic + user push: the prepared A1 (whole plane→WE) had inherited #730's
"structured exactly like capability-manifest" *dictum* instead of its *holding* (which split `service.ts`
mid-file). Same grounding trap as [[feedback_verify_grounding_claims_before_ratifying]] (#730 C1's MaaS
precedent). Builds on [[project_generator_is_tool_not_we_standard]] (only the contract crosses the seam)
and [[project_contract_distribution_published_package_endstate]] (#872 type-only package; mixed modules
split type→WE, runtime→FUI). Follow-up #893 (export+carve).

Adjacent direction logged as #899 (not ratified): implementer conformance is **behavioral** (the final
rendered component is all that counts; build varies), so a static `check.ts` can't verify it. WE ships a
conformance KIT (vector corpus as declarative JSON + schema + binding interface); plateau hosts the
in-browser exerciser (controllable clock, dashboards); implementer supplies a binding + own browser driver.
WPT model (tests+testharness.js = kit, wpt.fyi = product). Floor must stay escapable (minimize-lock-in).
Don't conflate with #809 FUI block workbench.

**AMENDED 2026-06-22 by #1566** (ratified): the conformance verifier **IMPLEMENTATION** + the **run** are
**Plateau**, not WE — even a "dependency-free reference verifier" is executable, and WE holds zero executable
([[project_we_zero_standard_implementation]]). WE keeps only the **declarative contract** (binding interface
+ vector/golden corpus + schema). The line-18 `check.ts` carve-out is **bound**: it stays WE only when the
gate checks WE's **own declarative artifacts** (manifests, corpus completeness/schema-validity) — a verifier
that judges a running *implementation's output* moves to Plateau (neutral, non-implementer). Codified in
[[project_platform_decisions_statute_layer]] #devtools-placement + #constellation-placement. See
[[project_conformance_verifier_vs_subject]].

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#constellation-placement` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
