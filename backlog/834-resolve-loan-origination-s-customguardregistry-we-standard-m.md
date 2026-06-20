---
kind: decision
size: 2
parent: "823"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#constellation-placement
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: none
preparedDate: "2026-06-17"
relatedReport: reports/2026-06-17-loan-guard-fui-resolution.md
locus: frontierui
tags: []
---

# Resolve loan-origination's CustomGuardRegistry (WE standard model) when the app moves to FUI

When #823 moves loan-origination to FUI, its one WE-only **standard-model** dependency — the Guard
protocol registry (#288/#289) — has no FUI home and its relative import breaks. This is a **placement
call over shipped code**, grounded in WE's own ratified precedents (constellation · #694 · #700 ·
*impl-is-not-a-standard* · *exercise-app-conformance-loop*; traced to the tree in the linked report), not
greenfield design — so no `/research/` topic, just the concrete-refs check. **One genuine fork** below
with a **bold** recommended default; B and C are named-rejected branches.

## The axis — how the loan app's guard dependency resolves in FUI

Loan's guard footprint is exactly two modules: the dispatching table `we:guard/registry.ts:39`
(`CustomGuardRegistry`, imported at `we:demos/loan-origination/app.ts:29`, composed at
`we:app.ts:99-102`) and the contract `we:guard/provider.ts` (`CustomGuardProvider` / `ALLOW`, imported at
`we:demos/loan-origination/domain/permissions.ts:30-31`). It does **not** touch `we:guard/accessControl.ts` or
`we:guard/index.ts`. The registry is *composed and exposed but not yet applied* — the consuming UI is the
future S10 slice (`we:app.ts:101`). `guard/` is a **closed set, internal deps only** (`we:provider.ts` is a
leaf; the other three import only `we:./provider.js`) — the same property that made the #694 family
migration mechanical. The single question: where does that import resolve once the app lives in FUI,
which has no `guard/` dir.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — guard's FUI resolution | **A — copy the guard closed-set up to `@frontierui/blocks` byte-identical (#694 + #170 pattern); WE's copy stays drift-source until #658 flips canonicality to FUI; `protocol:guard` spec stays WE-only & canonical** | A′ contract-split (copy only dispatch/member impl, keep `we:provider.ts` WE-canonical) | High (~90%) |

## Fork 1 — how does loan's guard dependency resolve in FUI?

**Fork-existence justification:** the alternative B (inline a hand-rolled registry) is *broken* — it is an
active-bypass of the WE guard standard, which the exercise app exists to dogfood (*active-bypass = FAIL*).
So exactly one branch is correct → this is a forced-toward-A ratify; the only genuine residual either/or is
the *shape* of bringing guard to FUI (A whole-set copy vs A′ contract-split), which cannot coexist (the
contract module either lives byte-copied in FUI or it doesn't).

**First — "WE-resident impl" is a transitional fact, not WE's charter.** WE's end-state role is
standard-only: specs, protocols, intents, and the `plugs/` platform substrate. WE does **not** own
component/handler *implementation* as a matter of charter. But the repo still physically hosts un-migrated
impl today — `blocks/`, `guard/`, and the runtime guard classes (`we:registry.ts`, `we:accessControl.ts`, and the
concrete `NativeGuardProvider`/`assertGuardDecision`/`ALLOW` in `we:provider.ts`) are **implementation living in
the WE repo pending migration**, not standard artifacts. Draining that impl up to `@frontierui/blocks` is the
explicit job of the open epic **#658** (6 of 9 families already moved byte-identical by #694). The genuine
standard artifact that stays WE-canonical is the **`protocol:guard` spec** (the `/protocols/` page) — never
the runtime module. So when this card says "WE-resident impl," it means *impl that happens to sit in WE
awaiting its FUI home* — and **this decision is one instance of moving it there**, not WE keeping it.

**Crux:** FUI consumes that WE-resident (pending-migration) impl by **byte-identical copy** (#694, gated
content-equal-upstream-first #170), the mechanism the constellation ships **today**. Loan already composes
four #694 families (audit/lifecycle/master-detail); the guard registry is one more piece of composed infra
alongside them. Per *impl-is-not-a-standard*, a **registry-dispatching** handler is the delivery side (→ FUI);
the genuine standard *artifact* is the `protocol:guard` spec (the `/protocols/` page), which stays WE-only
wherever the runtime module sits.

**Correction (2026-06-17) — #700's ruling is *unidirectional*, not bidirectional; C is not excluded.** An
earlier draft of this card cited #700 (DC-7) as ruling against "any cross-repo WE↔FUI import path." Read in
full, #700 ruled only on the **WE→FUI** direction — WE's docs/demos importing FUI's compiler (the *standard*
reaching down into *impl*), which inverts the constellation arrow. It says nothing about **FUI→WE** (impl
depending on a published WE standard contract), which is the *correct* arrow and is actively endorsed by
**#239** (`@webeverything/*` reserved for standard artifacts; contracts modelled as published packages whose
name == specifier). So a WE-**published, type-only contract package** that FUI depends on is a legitimate —
arguably the *intended end-state* — mechanism, with byte-replication being the **interim** (cf. #239's note
that jsx-runtime duplication is tracked by #240/#170). This card ratifies the interim copy now and **carves
the end-state mechanism to a new epic** (see Context), rather than re-litigating a ruling that never closed it.

**Options:**

- **A — copy the guard closed-set (`guard/{provider,registry,accessControl,index}.ts` + `__tests__`) up to
  `@frontierui/blocks` byte-identical; add a `./guard` exports entry; `diff -q` clean; WE copies untouched.
  The `protocol:guard` spec stays WE-only and canonical. (recommended default.)** Loan's import resolves in
  FUI unchanged; mechanically a near-clone of #694 (closed set, no external deps, byte-verified). Drift is
  gated by the same byte-equality check #694 relies on. Merit cost: places the contract module
  (`we:provider.ts`) in FUI — see A′.
- **A′ — contract-split: copy only the dispatch/member impl (`we:registry.ts`, `we:accessControl.ts`), keep
  `we:provider.ts` WE-canonical.** Honours *npm-scope-mirrors-layer* most literally (FUI holds no standard
  contract). But the FUI registry copy must then reach the WE contract; *without* a published-contract
  mechanism (= C, deferred to the new epic) that means a copy of the contract too (= A). As a same-repo
  file-level split it's also incoherent — both `we:registry.ts` and `we:accessControl.ts` import the **runtime**
  `assertGuardDecision` from `we:provider.ts`, and `we:provider.ts` is a **mixed module** (types + runtime), so the
  type half can't be cleanly held WE while its co-located runtime moves (#170 forbids splitting one migrated
  file). Superseded by C-as-end-state, not by A.
- **B — decouple: inline a minimal registry in loan's domain code.** *Rejected — conformance bypass.* The
  app exists to dogfood WE standards (*exercise-app-conformance-loop*); a hand-rolled registry is
  *active-bypass = FAIL* and discards the S1b (#687) wiring of the real access-control provider through the
  standard.
- **C — FUI depends on a WE-**published, type-only** contract package (`@webeverything/contracts`, FUI→WE
  arrow).** *The end-state, deferred — not rejected.* This is the literal form of "FUI is only impl of WE's
  contract": WE authors+publishes the contract, FUI imports it (no copy, single source of truth). Not excluded
  by #700 (which ruled the *opposite* arrow) and endorsed by #239. Deferred because it's a **constellation-wide
  mechanism** (every contract — guard, validators, positioning, the #694 families), badly over-scoped for this
  size-2 guard placement, and carries its own risks (version-skew as a new drift surface; publish/CI ceremony;
  dev-time wiring). Carved to its **own epic** with build + risk-mitigation stories (see Context). A's byte-copy
  is the reversible interim that this end-state later supersedes.

**Recommended default: A (as the short-term interim).** FUI carries a **byte-identical, drift-gated replica**
of guard so loan's import resolves — the established #694 mechanism. Note the honest framing: FUI *does*
physically carry the contract code (it must, to compile), so "the contract stays WE-only" is true only of the
**spec artifact** + **canonical authority** (WE authors it; FUI's copy is read-only, #170-gated), **not** of
the contract bytes. The cleaner end-state is C (FUI imports a WE-published contract package), now correctly
understood as *deferred, not excluded*.

## Ruling (2026-06-17) — A as the agreed short-term copy; C carved to its own epic

Decided in discussion. **Ratified: A — byte-copy the guard closed-set up to `@frontierui/blocks`** as the
reversible short-term interim; built under **#836**. Rationale: near-mechanical #694 clone, unblocks loan now,
fully reversible. **A′ is refuted on the facts** — `we:provider.ts` is a *mixed module* (contract types +
runtime `assertGuardDecision`/`ALLOW`/`GuardDecisionError`/`NativeGuardProvider`), so the type half can't be
cleanly held WE while its co-located runtime moves; #170 forbids splitting one migrated file. **B rejected**
(active-bypass = FAIL).

**The discussion surfaced a higher-leverage finding that supersedes the "A is the right *end-state*" framing:**
the constellation's real binding mechanism for FUI-on-WE-contracts should be a **WE-published, type-only
contract package** (C, the FUI→WE arrow) — *not* perpetual byte-replication. #700 was mis-cited as excluding
this; it ruled only on the WE→FUI arrow. C is endorsed by #239 and is the literal form of "no contract, no
implementation." Per the user's call, **this is not deferred indefinitely** — it's carved to a dedicated epic
(build + risk-mitigation + CI stories), applies to **all** contracts, and will later supersede A's byte-copy
(and the #694 family copies). Confidence ~90%; residual is the package-mechanism design captured in that epic.

---

## Context

- **Blocks #836** (host loan-origination in FUI, already `blockedBy #834`). Resolving this yields the
  byte-copy build (interim path A).
- **End-state mechanism carved to epic #872** — "Constellation contract distribution via WE-published
  type-only contract packages" (children #873 split · #874 publish · #875 FUI-migrate · #876 version-skew
  gate · #877 CI publish · #878 dev wiring). That epic later supersedes A's byte-copy (the migration is
  #875). Applies to all contracts, not just guard.
- Sibling in the #823 slice DAG: `#833 → {#835 ∥ (#834 → #836)} → #837`.
- The **runtime** guard form is a separate plug (`plugs/webguards/`, extends core `CustomRegistry`,
  injector-chain); loan uses the **standalone model** (`guard/`), not the plug — so the plug's WE home is
  not in scope here.
- Full trace + concrete refs in `we:reports/2026-06-17-loan-guard-fui-resolution.md` (linked via
  `relatedReport`).
