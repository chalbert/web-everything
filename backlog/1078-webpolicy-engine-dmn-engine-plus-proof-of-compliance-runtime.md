---
type: decision
workItem: story
size: 5
parent: "1028"
status: resolved
blockedBy: ["1077"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:webpolicy/enforcement.ts"
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-we-resident-reference-runtime-placement.md
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
tags: []
---

# webpolicy engine — DMN engine plus proof-of-compliance runtime in FUI

Slice B of webpolicy impl epic #1028 (blockedBy slice A contract). Implement the DMN engine + proof-of-compliance runtime in FUI (evaluate DMN decision tables, emit a signed proof-of-compliance), conforming to the WE contract.

> **Prepared 2026-06-20** (`/prepare`). Grounding report: `we:reports/2026-06-20-we-resident-reference-runtime-placement.md`. This ratifies *shipped* code (the runtime exists), so the web prior-art survey is skipped per backlog-workflow → Fork-readiness pass; no new `/research/` topic — the load-bearing prior art (the standards-body reference-implementation tier) is captured as the grounding digest below.

## Grounding digest

The DMN engine + proof-of-compliance runtime the card asks for **already exists and is conformant, in WE** — it was never built in FUI:

- `we:webpolicy/enforcement.ts:16-30` — `PolicyDecisionPoint` (pure PDP, DMN hit policies UNIQUE/FIRST/PRIORITY/COLLECT), `PolicyEnforcementPoint`, `comparatorEvaluator`, `HitPolicyViolation`; clock/signer/facts all injected.
- `we:webpolicy/proof.ts:1-20` — `ProofChain` (SHA-256 hash chain + Merkle checkpoint to a transparency log + OSCAL bundle), `ProofRecord`, swappable `Signer`.
- `we:webpolicy/__tests__/` — **23 tests** (13 `we:enforcement.test.ts` + 10 `we:proof.test.ts`), green.
- `we:demos/webpolicy-conformance-demo.ts:11-13` — imports and exercises the **real** runtime.
- `we:webpolicy/contract.ts:6-8` — the type-only contract header annotates `we:enforcement.ts` as "impl … (→ FUI)": the *documented intent* is FUI, the *physical home* is WE.

**This is not isolated to webpolicy.** Ten WE standard dirs carry runtime today — `we:reliability/`, `we:intl/`, `we:analytics/`, `we:process/` (provider/registry/driver), `we:webpolicy/`, `we:webcompliance/`, `we:webtheme/`, `we:webcases/`, `we:webtraits/`, and the active webexpressions interpreter — and the precedent chain is recent and ratified (#1052/#1055 landed, **#1071 resolved** graduatedTo `we:process/provider.ts` "mirroring the landed reliability + intl provider precedent"). Five newer siblings (webidentity/webnotifications/webrealtime/webresources/webanalytics) + plugs (#606) went FUI-side. So the statute and every `we:contract.ts` header *say* `→ FUI`; the landed tree and the most recent decisions *do* WE.

**Prior art that names Option A.** Standards bodies separate three artifacts: the **normative spec** (the lock), the **conformance test suite** (`wpt`, `test262` — the vectors), and a **reference implementation** — an executable that proves the contract is implementable and gives the suite something real to run, carrying *no lock-in* (vendors ship their own optimized engines; the contract is the only lock). `wpt`/`test262` live in the standards repo yet are never the shipped normative deliverable. A WE-resident runtime consumed by WE's conformance demos + vitest is exactly a reference implementation — orthogonal to the `@webeverything` *package* staying types-only (#239/#872).

## Scope — what #1078 does and doesn't decide (discussion 2026-06-20)

The decision touches exactly one of **three** distinct conformance artifacts. Two are already settled and move regardless of Fork 1:

| Artifact | What it is | Audience | Home |
|---|---|---|---|
| 1. Spec-integrity gate | validates WE's *own content* is well-formed (contract type-checks, vectors consistent, locus/naming) | private to WE | `we:check:standards` — already WE, **uncontested** |
| 2. Implementer conformance suite | behavioral **vectors + harness** an implementer points at *their own* engine (the `wpt`/`test262` role) | FUI + forward-adapter targets | **vectors → WE (shared); harness → plateau tool** (#899) — **settled, not #1078** |
| 3. Reference implementation | executable that proves the contract is implementable + fuels WE's own conformance playground | WE-internal (dogfood) | **← the only thing #1078 decides** (A WE-resident · B FUI) |

Implementers never run `we:webpolicy/enforcement.ts`; they run the **vectors** (artifact 2) against *their* engine. So "keeps WE's conformance proof" is **not** the argument for A — that proof is vectors + the #899 plateau harness, which survive B. A's real value is narrower: a dogfood/executable spec, fuel for WE's conformance playground, and a known-good oracle to author the vectors against.

**Two kinds of "demo" — WE does delegate, but not this one.** WE delegates **component/block** demos to FUI (never imports FUI block code; embeds via the `fuiDemo` iframe — #701/#700/#604, `we:docs/agent/block-standard.md:75`, `we:docs/agent/platform-decisions.md:84-85`). But **standard/contract conformance playgrounds are WE-owned and in-repo**, and the **Definition of Done mandates one per standard feature** (`we:docs/agent/backlog-workflow.md:142`). `we:demos/webpolicy-conformance-demo.ts` is this kind — a *headless* DMN/proof-chain proof, not rendered UI — so its WE residence is required, not a boundary leak. This is a **structural argument for A**: under B the mandated demo can only import FUI runtime (**forbidden**) or become a `fuiDemo` iframe — but that convention is built for *rendered FUI components with branding chrome*, which a headless logic/proof contract does not fit. Under A the demo just imports the in-repo reference runtime.

This surfaces the **sharpened sub-question inside Fork 1**: *should a headless-logic standard have a WE-resident conformance playground at all, or is headless conformance the #899 plateau tool's job?* The component→FUI relocation precedent (`we:docs/agent/demo-workflow.md:184`, #823/#824) is all about *rendered UI* and does not obviously reach a logic/proof contract. WE-playground stands → A near-forced; headless conformance belongs in the plateau tool → B gets cleaner.

## Axis-framing

The single axis is **where the reference implementation of a WE standard lives** — and the decision turns on whether `#817`/`#855`'s "all runtime → FUI, code never crosses the seam" protects (1) the *published seam* (`@webeverything` is types-only; FUI never *imports* WE runtime — `we:webpolicy/contract.ts:4-5`) or (2) *any executable code in the WE repo at all*. The strict #817 reading (memory *Placement Test: Does FUI Consume The Runtime?*) keeps a runtime in WE **only** if a WE-side `we:check.ts` gate consumes it — the only such gate is `we:capability-manifest/check.ts`, so the strict reading marks all ten runtimes misplaced. But WE has no per-subsystem `we:check.ts`; conformance is proven by **demos that run the real runtime + vitest**, and the #899 plateau-conformance tool the strict reading presumes **is not built** — so the strict cut today removes WE's executable proof and replaces it with nothing. `#932` already drew the reconciling line: the WE *website* ≠ the WE *standard*; the boundary is **source-dependency direction, not runtime execution**. A WE-repo reference runtime consumed only by WE's own demos/tests never inverts the WE→FUI arrow.

## Recommended path at a glance

| Fork | Question | Options | Recommended default | Confidence |
|---|---|---|---|---|
| 1 | webpolicy runtime home | A accept WE-resident · B relocate WE→FUI | **A — accept WE-resident (reference-implementation tier)** | ~70% |
| 2 | the rule this establishes | 2a canonical + reconcile · 2b per-subsystem optional | **2a — canonical WE reference-runtime rule, codify + reconcile** | ~75% |

### Supported by default (not forks)
- **`@webeverything` package stays types-only** (#239/#872) — untouched by either fork; the published seam is non-negotiable and *both* options honor it. Not a fork (no coherent "publish runtime in @webeverything" branch exists).
- **FUI ships the production impl** — A keeps a WE *reference* runtime *and* leaves FUI free to ship an optimized impl; they compose, they don't exclude. The reference impl carries no lock-in (swappable; contract is the only lock).
- **The order of reconciling any divergent sibling** is ordinary prioritization (filed separately), never a fork (memory *Fork Is Not A Prioritization Tool*).

## Fork 1 — webpolicy runtime home

*Fork-existence:* a single runtime module lives in exactly one repo, so A and B genuinely cannot coexist — and the strict #817 reading actively *excludes* A (marks `we:webpolicy/enforcement.ts` misplaced) unless the statute is refined. Real either/or.

- **A — accept WE-resident (recommended).** Resolve as-is against `we:webpolicy/enforcement.ts` + `we:webpolicy/proof.ts`; classify the runtime as the standard's **reference implementation** (executable spec / dogfood), consumed by `we:demos/webpolicy-conformance-demo.ts` + the 23 tests. Matches the dominant + most recent ratified practice (#1071/#1052/#1055), keeps WE's executable conformance proof, creates no lock-in, churns nothing. Correct the `we:contract.ts` header's "→ FUI" annotation to "→ FUI production impl; reference impl in WE".
- **B — relocate WE→FUI.** Honor the strict statute + the header intent: move `we:enforcement.ts`/`we:proof.ts` (and the 23 tests) to FUI, add the `@webeverything/contracts/policy` distribution entry, repoint the demo to a FUI-hosted runtime (iframe per the embed boundary), and stand up the #899 plateau conformance tool so WE retains *some* behavioral proof. Boundary-purest, but high churn and presupposes unbuilt infrastructure.

*Default rationale / red-team:* the strongest attack — "#817/#855 are recent ratified **standards** (high reversal bar), and every `we:contract.ts` header documents the FUI intent" — is answered by the published-seam-vs-repo distinction: A does **not** touch the published seam #817 actually protects, and refines a clause whose own premise (#899) was never built. The **DoD-mandated conformance playground** (`we:docs/agent/backlog-workflow.md:142`) adds a structural leg: WE must ship a webpolicy conformance demo and may not import FUI code, so B forces that headless demo into the `fuiDemo` iframe convention — built for *rendered* FUI components, not a logic/proof contract. The genuine open sub-question (see *Scope* §): **does a headless-logic standard get a WE-resident conformance playground (→A near-forced), or is headless conformance the #899 plateau tool's job (→B cleaner)?** If the decider rejects the published-seam distinction *and* routes headless conformance to the plateau tool, Fork 1 → B and Fork 2 → a relocation cleanup epic. Confidence held ~70–75% post-discussion. **High-leverage — flag for the deciding agent's skeptic pass.**

## Fork 2 — the rule this establishes (statute scope)

*Fork-existence:* the inconsistency spans ten subsystems; the statute layer exists so one rule is cited, not re-litigated per subsystem (memory *Platform Decisions = Statute Layer*). "Decide #1078 as a one-off" (`codifiedIn: one-off`) is a coherent but weak branch — it leaves the statute permanently contradicting practice. Real either/or on *whether a reusable rule is minted*.

- **2a — canonical WE reference-runtime rule + reconcile (recommended).** Refine `#constellation-placement` rule 1: *the `@webeverything` package is types/vectors-only (unchanged); the WE **repo** may host a non-published **reference runtime** consumed by its own conformance demos/tests — the executable spec — while FUI ships the production impl.* Set `codifiedIn: we:docs/agent/platform-decisions.md#constellation-placement` with lineage "refines #817 — published-package purity vs repo-internal reference runtime". The divergent FUI-side siblings (webidentity/etc.) are reconciled toward the rule as ordinary prioritized work (not blocking this call).
- **2b — per-subsystem optional.** Treat placement as a per-subsystem judgment, both conform, no canonical rule (`codifiedIn: one-off`). Rejected as the default: it permanently institutionalizes the drift and defeats the cite-don't-re-litigate purpose of the statute layer.

*Default rationale:* 2a follows config-extends-platform-default (one canonical default, restriction is opt-in) and the statute-layer discipline. Residual: reconciling siblings is real work — but it is *prioritization*, sequenced after the rule, not a reason to skip minting the rule.

---

## Ruling — RATIFIED 2026-06-20

- **Fork 1 → A (accept WE-resident).** `we:webpolicy/enforcement.ts` + `we:webpolicy/proof.ts` are the standard's **reference implementation** — an executable spec consumed by `we:demos/webpolicy-conformance-demo.ts` + the 23 tests, while FUI ships the production impl. No churn; WE keeps its executable proof; no lock-in. Corrected the `we:webpolicy/contract.ts` header "→ FUI" annotation to "production impl → FUI; WE copy is the reference implementation per #1078".
- **Fork 2 → 2a (canonical rule, codified).** Refined `we:docs/agent/platform-decisions.md#constellation-placement` rule 1 with the **reference-implementation tier** (lineage: refines #817 — published-package purity vs repo-internal reference runtime; generalises the embed-boundary rule-4 block carve-out to subsystem engines). `codifiedIn` stamped. Divergent FUI-side siblings (webidentity/webnotifications/webrealtime/webresources/webanalytics) reconcile toward the rule as ordinary prioritized work — not blocking.
- **Decided by discussion (not a fork):** #1078 decides only the **reference implementation** (artifact 3); the spec-integrity gate (`we:check:standards`) and the implementer conformance suite (vectors → WE, harness → #899 plateau tool) are separate and unchanged. WE owns standard conformance *playgrounds* (DoD-mandated, in-repo) but delegates *component* demos to FUI — the structural leg under A.
- **Follow-up filed:** the demo-surface reframe (conformance = a project-strength **status** surface; `/demos/` = WE protocols in *real action*) → #1216.

## Progress

- **Status:** resolved — ratified A + 2a, statute + contract header + item updated, all gates green.
