# WE-resident reference runtime vs FUI relocation — placement grounding (#1078)

**Date:** 2026-06-20
**For:** backlog #1078 (webpolicy DMN engine + proof-of-compliance runtime home), and the
statute-level question it forces for #constellation-placement.
**Type:** placement decision over *shipped* code — no greenfield design, so this skips the web
prior-art survey (per backlog-workflow → Fork-readiness pass) and instead grounds the call in (a) the
real tree, (b) the recent ratified precedent chain, and (c) the standards-body reference-implementation
pattern.

## The trigger

Slice B of the webpolicy impl epic (#1028) asked to "implement the DMN engine + proof-of-compliance
runtime **in FUI**." But the runtime **already exists, conformant, in WE**:

- `we:webpolicy/enforcement.ts` — `PolicyDecisionPoint` (DMN hit policies UNIQUE/FIRST/PRIORITY/COLLECT),
  `PolicyEnforcementPoint`, `comparatorEvaluator`, `HitPolicyViolation`. Pure, injected clock/signer.
- `we:webpolicy/proof.ts` — `ProofChain` (SHA-256 hash chain, Merkle checkpoint to a transparency log,
  OSCAL bundle), `ProofRecord`, swappable `Signer`.
- `we:webpolicy/__tests__/` — **23 tests** (13 enforcement + 10 proof), all green.
- `we:demos/webpolicy-conformance-demo.ts` — imports the **real** runtime and exercises it.

`#1077` (resolved) only *extracted* the type-only `we:webpolicy/contract.ts` out of it. The contract
header (`we:webpolicy/contract.ts:6-8`) annotates `we:enforcement.ts` as "impl … (→ FUI)" — i.e. the
**documented design intent is FUI**, but the code physically lives in WE.

So the substance is delivered; the only open question is the **home** — and it is not isolated to
webpolicy.

## The real tree — WE-resident runtime is pervasive, not a one-off

Top-level WE standard dirs that carry **runtime** modules (engines / providers / drivers, not just
`we:contract.ts`), as of 2026-06-20:

| Subsystem | Runtime in WE | How ratified |
|---|---|---|
| `we:reliability/` | `we:provider.ts` `we:registry.ts` `we:index.ts` | landed precedent (#1052) |
| `we:intl/` | `we:provider.ts` `we:registry.ts` `we:index.ts` | landed precedent (#1055) |
| `we:process/` | `we:provider.ts` `we:registry.ts` `we:driver.ts` `we:index.ts` | **#1071 resolved** — graduatedTo `we:process/provider.ts`, "mirroring the landed reliability + intl provider precedent" |
| `we:analytics/` | `we:provider.ts` | landed |
| `we:webpolicy/` | `we:enforcement.ts` `we:proof.ts` | this card (#1078) |
| `we:webcompliance/` | `we:gate.ts` `we:audit.ts` `we:waiver.ts` | landed |
| `we:webtheme/` | `we:compile.ts` `we:schemes.ts` `we:tokens.ts` `we:defaultTokens.ts` | landed |
| `we:webcases/` | `we:generateCase.ts` `we:compileRequirement.ts` `we:driftCheck.ts` `we:requirementValidator.ts` | landed |
| `we:webtraits/` | `we:intentProfileResolver.ts` | landed |
| webexpressions | `InterpolationTextNode` interpreter + parsers (status:active) | shipped long ago |

Subsystems whose runtime is **absent** from WE (built FUI-side in batch-2026-06-19, per #1078's surface
note): `webidentity`, `webnotifications`, `webrealtime`, `webresources`, `webanalytics`; plus plugs
(#606 → FUI).

**Finding:** the WE-resident reference runtime is the *dominant and most recent* pattern (10 subsystems,
incl. the freshly-ratified #1071 chain), while the strict "runtime → FUI" appears in ~5 newer siblings
and the plugs ruling. The statute and every `we:contract.ts` header *say* FUI; the landed tree and the
recent ratified decisions *do* WE. That is the inconsistency #1078 surfaces.

## The statute that governs — and where it strains

`we:docs/agent/platform-decisions.md#constellation-placement` rule 1 (codifying #730/#817):

> Code that **defines a contract** … **or is consumed by a WE-side conformance gate** (`we:check.ts`) →
> **Web Everything**. Code that **delivers a capability at runtime** (registry-dispatching,
> artifact-producing, a running handler — incl. `assert*`, constants, **engines**, native-default
> strategies) → **Frontier UI**.

Read strictly (the #817 holding, memory *Placement Test: Does FUI Consume The Runtime?*): a runtime
symbol stays in WE **only** if a WE-side `we:check.ts` conformance gate consumes it — a *demo* or a *test*
does not count. Under that reading, `we:webpolicy/enforcement.ts` (an engine, consumed only by a demo +
tests) → FUI. The only `we:check.ts` gate in the tree is `we:capability-manifest/check.ts`; no standard-dir
runtime is consumed by one. So the strict statute marks **all ten** WE-resident runtimes as misplaced.

The strain: in practice WE has no `we:check.ts`-style behavioral conformance gate per subsystem — conformance
is proven by **demos that run the real runtime** + **vitest suites**. The #899 plan ("behavioral
conformance = a plateau in-browser tool over WE vectors") that the strict reading presumes **is not
built**. So the strict cut, applied today, would *remove* the executable proof WE currently relies on
and replace it with nothing.

## Prior art — the reference-implementation tier

Standards bodies don't ship a normative spec naked. They ship three separable artifacts:

- **Normative spec / contract** (WHATWG/W3C prose; TC39 spec text) — the lock.
- **Conformance test suite** (web-platform-tests `wpt`; TC39 `test262`) — the vectors.
- **Reference implementation** — an executable that *proves the contract is implementable* and gives the
  test suite something real to run against (e.g. the WHATWG reference parsers, reference CSS engines,
  Babel/engine262 for ECMAScript). It is **not** the production impl; vendors ship their own optimized
  engines. It carries **no lock-in** — it is swappable, and the contract is the only thing implementers
  must honor.

This is the missing vocabulary for #1078's Option A. A WE-resident runtime consumed by WE's conformance
demos + vitest is a **reference implementation** in exactly this sense: it makes the standard *provable*
and *dogfoodable*, while FUI ships the production impl and projects may swap in their own. Crucially, a
reference impl living in the **WE repo** is orthogonal to the **published package** staying types-only
(`@webeverything` = standard artifacts only, #239/#872) — `wpt` and `test262` live in the standards repos
and are not shipped as the normative deliverable, yet they're indispensable.

This reframes the fork: it is **not** "purity vs sloppiness." It is *where the reference implementation
of a WE standard lives* — the **WE repo** (A, the executable spec / dogfood) or the **FUI repo** (B, FUI
owns even the reference impl; WE ships vectors only and conformance moves to the unbuilt #899 plateau
tool).

## The reconciling distinction

`#817`/`#855` ("WE = contracts only; code never crosses the seam; all runtime → FUI") were ruled to
protect **two** things that this fork lets us separate:

1. **The published seam** — `@webeverything` must be types/vectors only; FUI must never need a runtime
   *import* from WE; the contract crosses, code never does. **Non-negotiable, untouched by either option.**
2. **Repo-internal executable code** — whether the WE *repo* may contain a non-published reference
   runtime that powers its own conformance demos + tests.

`#817`'s "consumed by a `we:check.ts` gate" carve-out is really a proxy for "is this code load-bearing for
WE's own conformance?" A conformance **demo that runs the real runtime** + a **vitest suite** are the
same category of consumer as a `we:check.ts` — the statute just never enumerated them because, at the time,
behavioral conformance was assumed to migrate to plateau (#899). `#932` already established the adjacent
principle: **the WE *website* ≠ the WE *standard*** — a consumer page is free to run WE (and FUI)
runtimes; the boundary is *source-dependency direction*, not *runtime execution*. A WE-repo reference
runtime consumed only by WE's own demos/tests never inverts the WE→FUI arrow.

## Recommendation (prep stance — not a ratification)

- **Fork 1 — accept WE-resident (Option A), ~70%.** It matches the dominant + most recent ratified
  practice (#1071/#1052/#1055 + 10 subsystems), keeps the executable proof WE relies on today, creates
  no lock-in, and churns nothing. Residual: it requires *refining* #817's "all runtime → FUI" to
  "published package types-only; repo may host a non-published reference runtime" — a conscious statute
  amendment, and the file headers' "→ FUI" annotations must be corrected.
- **Fork 2 — make it the canonical rule, reconcile (Option 2a), ~75%.** The inconsistency spans 10
  subsystems; the statute layer exists precisely so one rule is cited, not re-litigated per subsystem.
  Ratifying A as a one-off (`codifiedIn: one-off`) would be wrong — it plainly generalizes. Residual:
  reconciling the FUI-side siblings is real work (either give them WE reference runtimes too, or
  explicitly grandfather them).

The strongest red-team against A — "#817/#855 are recent ratified *standards*, which carry a high
reversal bar, and every `we:contract.ts` header documents the FUI intent" — is answered by the
published-seam-vs-repo distinction above: A does **not** touch the published seam #817 actually
protects; it refines a clause whose own premise (#899 plateau conformance) was never built. If the
decider rejects that distinction, Fork 1 → B, and a relocation cleanup epic must move all ten runtimes
(+ their demos/tests) to FUI and stand up the #899 plateau conformance tool first.

## What this is NOT

- Not a lock-in question — a reference impl is swappable; the contract is the only lock (memory:
  *Minimize Lock-In*).
- Not "impl is a standard" (#020/#855) — the reference runtime is **not** published in `@webeverything`
  and **not** imported by FUI; it is repo-internal conformance machinery, like `wpt`/`test262`.
- Not a per-subsystem prioritization call — Fork 2 settles the *rule*; the *order* of reconciling any
  divergent sibling is ordinary prioritization, filed separately.
