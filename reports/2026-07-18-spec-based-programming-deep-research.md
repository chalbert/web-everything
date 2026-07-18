# Spec-based programming for AI agents — deep research (adversarially verified)

*Session report, 2026-07-18. Grounds #2564 (adopt spec-based programming) and #2563 Fork 1 (spec-vs-impl
review gate). Produced by the deep-research harness: 5 angles → 22 sources → 106 claims → 25 verified by
3-vote adversarial verification (22 confirmed, 3 refuted). Full run: 104 agents.*

## Verdict

Spec-driven development (SDD) for AI agents is **real but immature**, and the evidence **strongly supports the
concrete plan**: a **schema/contract spec (not prose)** as a review gate where a **spec change always needs a
human** and an **implementation change under a fixed spec is auto-cleared when a conformance suite stays
green** + an independent review agrees. The binding constraint on AI-assisted dependability is
**specification discipline, not model capability** — so investing in the contract gate beats chasing a better
generator.

## Confirmed findings

1. **The flagship SDD tools are prose-markdown generators, not machine-diffable formalisms.** GitHub Spec Kit
   (Constitution→Specify→Plan→Tasks→Implement, all markdown), Amazon Kiro (requirements→design→tasks in EARS),
   Tessl (the most radical "spec-as-source"). A diff of prose markdown **cannot** give a clean yes/no on "did
   the spec change?" — so these are *not* what we want as a mechanical gate. *(high; spec-kit docs, Fowler,
   arXiv 2602.00180)*
2. **Schema-as-spec is the deterministically machine-diffable option.** TypeSpec compiles one source to
   OpenAPI 3.0 / JSON Schema 2020-12 / Protobuf via reproducible emitters — so "did the contract change?" is a
   mechanical diff. This is the formalism class the plan needs. *(high; typespec.io)*
3. **Formal methods (TLA+) are only *partially* machine-checkable** — syntax is mechanical, semantics is not;
   a valid-parsing spec can still be behaviourally wrong. And **LLMs cannot yet author formal specs**:
   across 30 models / 2,730 runs, agent-generated TLA+ hit ≤26.6% syntactic, **8.6% semantic** correctness.
   This is why the human-authors-spec / agent-implements split is well-founded. *(high; arXiv 2606.05792)*
4. **Executable specs make drift a test failure**, gateable in CI (Specmatic fails the build on any deviation).
   **But a passing conformance test only proves code matches the spec, not that the spec is right** — a wrong
   spec yields faithfully-wrong code. Hence: human on every *spec* change + an independent review agent; the
   suite governs "code matches spec," never "spec is right." *(high; arXiv 2602.00180, specmatic)*
5. **Drift is empirically widespread** — 55% of Node-RED nodes exceed their declared spec. Justifies a
   *mechanical* drift gate over trusting discipline. *(high; arXiv 2502.09117)*
6. **Specmatic's "central contract repository" is a near-exact model for the constellation.** All contracts
   live in ONE repo that is the single source of truth; downstream service repos **reference** a spec path and
   **never own** it; cross-boundary changes are gated by a human-reviewed PR + backward-compat check on the
   contract repo, and a conformance suite in the service repos. This maps **WE (owns spec) → FUI/plateau
   (reference + implement)** almost one-to-one, and answers *where specs live* (centrally, at boundary-contract
   granularity) and *how to gate cross-boundary changes*. *(high; specmatic docs)*
7. **A published design already unifies #2563 + #2564 — the "Spec Growth Engine" (arXiv 2606.27045).** It
   **splits merge authority by blast radius**: outward-surface changes (root invariants, container boundaries,
   breaking contract changes) require **HARD human approval**; inward-surface changes (internal design, owned
   code, refactors) are **AUTO**. It makes drift a **blocking merge condition** by deterministically diffing an
   "Intent Graph" (from the spec) against an "Evidence Graph" (from static analysis); specific errors block
   unconditionally (orphan code, undeclared cross-boundary dependency, importing another module's internals).
   The agent updates the affected spec in the **same commit**; the human reviews only contract-level changes.
   *(**medium** — single-author, non-peer-reviewed **preprint** of an **unimplemented** design; treat as a
   blueprint to adapt, not proof. Its determinism assumes a statically-derivable dependency graph.)*
8. **The Productivity-Reliability Paradox.** Controlled studies show 20–56% speedups, yet the most rigorous
   RCT (METR 2025) shows a **19% slowdown** for experienced devs on mature codebases, and org telemetry shows
   a 98% jump in merged PRs coinciding with a **91% rise in review time** and flat delivery. Raw agent
   throughput inflates review cost without improving delivery — exactly the failure the independent-review gate
   and the *keep-changes-small* nudge are meant to contain. *(medium; arXiv 2605.01160)*
9. **The field is < 18 months old.** Fowler's maturity ladder — spec-first (written then discarded) →
   spec-anchored (kept + evolved) → spec-as-source (primary artifact) — puts essentially all current tooling at
   **spec-first**; a durable gate needs at least spec-anchored, which no tool delivers out of the box. So
   adopting this means **assembling** it (schema spec + contract tests + CI gate + authority tiers), not buying
   one mature tool. *(medium; Fowler)*

## Refuted (excluded — failed verification)

- CodeQL static analysis giving a clean machine yes/no on "does the implementation exceed the spec" (1-2).
- Invariant specs mechanically catching violations pre-production (1-2).
- The TDAD pipeline's 86–100% mutation-score claim (0-3).

## Open questions (for #2564's `/prepare`)

1. **Which WE-owned artifact is the central contract?** Do the existing intent/protocol definitions *become*
   the machine-diffable spec, or do we author a schema layer (TypeSpec→JSON Schema) above them? — the role
   Specmatic gives its central OpenAPI contract.
2. **Granularity + the mechanical contract-line.** Per-boundary-contract (fits Specmatic + blast-radius
   authority best) vs per-feature vs per-file — and how the "contract-level line" that triggers HARD human
   review is identified *mechanically* in our repos, not by convention.
3. **The independent-review agent's false-clear rate is unquantified** — no surveyed source measures a second
   AI reviewer's reliability on impl-only changes. The residual risk of the auto-clear path is unmeasured.
4. **The non-executable slice.** Drift is only mechanically detectable for the executable part; prose intent /
   EARS requirements / semantic invariants leave a governance gap for the human-interpretation remainder.

## Caveats

The two papers that match the target design most precisely (Spec Growth Engine 2606.27045; Productivity-
Reliability Paradox 2605.01160) are **single-author, non-peer-reviewed 2026 preprints** — blueprints, not
proof. "Machine-diffable" is a gradient: schema-as-spec + contract tests are genuinely mechanical; TLA+ is
mechanical for syntax only; prose markdown is not mechanical at all. The Node-RED 55% and TLA+ 8.6% figures are
exact but scoped (proxies for a full contract / one formal language). The space moves fast — this is a
2026-07 snapshot.
