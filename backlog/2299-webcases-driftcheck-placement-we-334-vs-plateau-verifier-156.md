---
kind: decision
parent: "1294"
status: open
priority: low
dateOpened: "2026-07-06"
preparedDate: "2026-07-09"
relatedReport: reports/2026-07-09-webtraits-webcases-placement-cascade.md
tags: [constellation-placement, relocation, webcases, conformance, decision]
---

# webcases driftCheck placement — WE (#334) vs Plateau verifier (#1566)

## Context

`we:webcases/driftCheck.ts` computes a mock-vs-real pass/fail verdict (`detectDrift` → `DriftReport`). Its
header cites #334 (webcases is the WE verification home); but #1566 later ruled the verifier of an
implementation's runtime output → out of WE, and **never amended #334**. Its output is a bespoke `DriftReport`,
not a #899 conformance vector, so #1816 (the non-verdict matcher) does not apply. Parked; blocks nothing live.

> **Prep note (2026-07-09, `/prepare all`).** Grounded by research topic
> [`webtraits-webcases-placement-cascade`](/research/webtraits-webcases-placement-cascade/) (report
> [we:reports/2026-07-09-webtraits-webcases-placement-cascade.md](../reports/2026-07-09-webtraits-webcases-placement-cascade.md)).
> A skeptic pass **refuted the stays-WE default**: #1566 explicitly overturned the "reads output as data → stays
> WE" pattern, and the WE carve-out is narrow (WE's *own* artifacts, no external implementation) — which a
> drift-vs-current-reality check fails. The prepared default is **relocate the executable verifier** while WE
> keeps the drift *contract*; the genre-exemption (below) is the decider's crux and keeps the stays-WE branch a
> live option.

## Grounding digest

- **`detectDrift` judges an implementation's runtime output.** `detectDrift(expected, actual)`
  (`we:webcases/driftCheck.ts:97`) compares the mock's declared `ContractResponse` (a WE artifact) against a
  `RecordedResponse` — *"a response as recorded from the real service"* (`we:webcases/driftCheck.ts:22`), i.e.
  an implementation's runtime output by construction. A `drifted:true` verdict is a statement about the *world*
  (the live service changed), not about the mock's internal validity.
- **#1566 overturned exactly this pattern.** `{#devtools-placement}` (`we:docs/agent/platform-decisions.md:326-337`)
  overturns *"reads output as DATA → stays WE (a verifier implements no standard)"* — *"judging is executable,
  and WE holds zero executable."* The verifier **implementation** (the code that judges a running
  implementation's output) → out of WE (Plateau, for neutrality).
- **driftCheck fails the WE carve-out.** The carve-out (`we:docs/agent/platform-decisions.md:338-342`) keeps
  only conformance tooling that checks *"WE's **own** declarative artifacts … needs no external implementation
  … WE cannot run once the impl is deleted."* driftCheck's whole purpose (#334: catch drift against **current
  reality**) needs a live external service, so a stale committed fixture defeats it — it is **outside** the
  carve-out.
- **#334 is the pre-#1566 ruling, never reconciled.** #334 (2026-06-13) ruled webcases the verification home;
  #1566 (2026-06-22, later + codified) overturned the "verifier stays WE" carve-out but never named #334. The
  `mock-contract` protocol #331 is a WE webcases project, and the #332 record transport
  (`fui:tools/mock-server`) is already FUI and injected (`we:webcases/driftCheck.ts` imports nothing from FUI).
- **The genre-exemption (live counter).** driftCheck verifies a *mock against its own backend* — the recorded
  response is the app's backend, **not a WE-standard implementer** being conformance-tested. #1566's turf is
  standard-conformance verifiers; a decider could judge its scope doesn't reach mock-realism drift and #334
  stands. This is the crux the ratify turn rules on.

## Axis-framing

The live axis is **where the executable drift verifier lives** — a constellation-placement call: relocation
moves `detectDrift`/`diffShape` out of the `@webeverything` export surface while the drift *contract* (types +
taxonomy + rule) stays. Running the fork-existence test: this is a **real fork** because two ratified rulings
genuinely conflict on one home — #334 (WE) vs #1566 (out of WE) — and the verifier lives in exactly one repo;
the *flawed* branch (keep the executable verifier in WE) is broken by #1566's overturned-pattern + the failed
carve-out **unless** the genre-exemption holds. The fork turns on a **code-level shape** (the injected-seam
signature + which symbols WE exports), so it carries a concrete code example. Which layer: **out of WE** —
sub-fork FUI (co-locate) vs Plateau (strict #1566).

## Recommended path at a glance

| Fork | Question | Recommended default (post-skeptic) | Main alternative (excluded) |
| --- | --- | --- | --- |
| 1 | Where does the executable drift verifier (`detectDrift`) live? | **(b) Relocate the verifier to FUI, co-located with the #332 mock-server record transport; WE keeps the drift contract (`DriftFinding` taxonomy + types + structural-not-value rule) + the #331 mock corpus.** #1566 sends the verifier out of WE; FUI co-location keeps the mock-server tool whole (its genre is mock-realism, not neutral standard-conformance). | **(a) Keep `detectDrift` in WE** (#334 literal — viable only if the genre-exemption is accepted) · **(c) Relocate to Plateau** (strict #1566 neutrality; splits the verifier from its FUI record-transport sibling) |

## Fork 1 — Where the executable drift verifier lives

**Fork exists because** two ratified rulings genuinely conflict over one home: #334 rules webcases (WE) the
verification home; #1566 rules the verifier of an implementation's runtime output *out* of WE and was never
reconciled with #334. The verifier lives in exactly one repo — WE **or** out — so the branches cannot coexist,
and the *flawed* branch (keep the executable verifier in WE) is broken by #1566's overturned-pattern
(`we:docs/agent/platform-decisions.md:326-337`) and the failed carve-out (`:338-342`) — **unless** the
genre-exemption below rescues #334.

- **(b) Relocate the verifier to FUI, co-located with the #332 record transport (default).** `detectDrift` +
  `diffShape` move to FUI beside `fui:tools/mock-server` (the #332 record mode that produces its input). WE
  keeps the **drift contract**: the `DriftFinding` kind taxonomy, the `ContractResponse` / `RecordedResponse` /
  `DriftReport` types, and the *structural-not-value* drift rule (`we:webcases/driftCheck.ts:16-19`), plus the
  #331 mock corpus. Rationale: #1566 sends the executable verifier out of WE, but its **Plateau-neutrality**
  rationale (don't co-locate a verifier with FUI, the *contestant*) does not bind here — driftCheck is not
  verifying a WE-standard implementer; it is a **mock-server-tool realism feature**, so it belongs with its
  record-transport sibling in FUI. This keeps the mock-server tool cohesive and avoids splitting record + drift
  across two repos.
- **(a) Keep `detectDrift` in WE (#334 literal — the genre-exemption branch).** Rest on #334 + the argument
  that driftCheck is a *different genre* than #1566's standard-conformance (the recorded backend is not a
  WE-standard implementer), so #1566's scope doesn't reach it, and `detectDrift` is a pure offline comparison
  over injected data (a validate script, memory rule #6). **Live but disfavored:** the carve-out criterion
  ("needs no external implementation") is genre-independent and driftCheck's purpose fails it — its verdict is
  about current external reality. Viable only if the decider rules the genre-exemption dispositive.
- **(c) Relocate to Plateau (strict #1566 letter).** #1566 codifies verifier-impl → **Plateau** (neutral
  product). Faithful to the letter, but **splits** the verifier from the #332 record transport (FUI) it is
  cohesive with, and applies the standard-conformance neutrality rule to a mock-realism tool that has no
  WE-standard contestant to stay neutral between. The alternative if the decider weights the #1566 letter over
  tool cohesion.

Symbol split under the default (keyed to the real module — what WE exports vs FUI owns):

```ts
// WE keeps the CONTRACT — we:webcases/driftContract.ts (types + taxonomy + the structural-not-value rule):
export interface ContractResponse { readonly status: number; readonly body: unknown; /* … */ }
export interface RecordedResponse { readonly status: number; readonly body: unknown; /* … */ }
export type DriftFindingKind = 'status' | 'missing-field' | 'extra-field' | 'type-mismatch' | 'content-type';
export interface DriftFinding { readonly kind: DriftFindingKind; readonly pointer: string; /* … */ }
export interface DriftReport { readonly drifted: boolean; readonly findings: DriftFinding[]; }
// + the #331 mock corpus stays WE

// FUI owns the VERIFIER — fui:tools/mock-server/driftCheck.ts (beside the #332 record transport), WE types in:
import type { ContractResponse, RecordedResponse, DriftReport } from '@webeverything/webcases/driftContract';
export function detectDrift(expected: ContractResponse, actual: RecordedResponse): DriftReport { /* diffShape */ }
// (a) keeps detectDrift in WE — legal ONLY if the genre-exemption defeats #1566's overturned-pattern.
```

**Skeptic:** REFUTED-the-stays-WE-default (hostile refutation, all four axes). **(0) Classification:** the
module's own header files driftCheck under "verification" (`we:webcases/driftCheck.ts:3`), pulling it into
#1566's turf — you cannot invoke #334's "verification home" and deny #1566's verification rules. **(1) Merit:**
`detectDrift` judges an implementation's runtime output (`RecordedResponse`, `:22`); being *injected* not
*imported* rescues nothing — #1566 splits the *run* from the *verifier impl* as separate relocations, and the
verifier-impl criterion (judging output) is met regardless of who runs the transport. **(2) Statute-overlap:**
the real one is **#334 vs #1566** — reconciled *contract-stays / verifier-moves*: #334's residual (taxonomy,
types, structural-not-value rule, #331 corpus) stays WE as the conformance contract; the executable verifier
leaves. `codifiedIn` on resolve must cite both and state the composition. **(3) Citation-scope:** #1566's text
says the verifier "judges" (`:333`), not "drives" — the "it drives nothing" defense narrows #1566 to save #334
and is not in its words. The one attack the stays-WE branch nearly beats it with — the mock-realism *genre* —
is recorded as (a)'s live counter, but the carve-out's "needs no external implementation" criterion still fails
it. **Screen:** clear (fresh-context two-confusion). (1) Contract-visible — `detectDrift` leaves the
`@webeverything` export surface; the taxonomy/types stay. (2) Merit remains free-of-cost — which layer owns
"verify an implementation's output" (#334 vs #1566) is a live boundary/dependency-direction call, not
prioritization.

## Downstream

Ratifying (b): author `we:webcases/driftContract.ts` (types + taxonomy), move `detectDrift`/`diffShape` to
`fui:tools/mock-server/driftCheck.ts` importing the WE types, keep the #331 mock corpus in WE, and record the
**#334↔#1566 reconciliation** in `we:docs/agent/platform-decisions.md` (contract-stays / verifier-moves; cite
both anchors). If the decider instead accepts the genre-exemption (a), record #1566-does-not-reach-mock-realism
as the reconciliation and leave driftCheck in WE. File as a #1294-child slice once ratified.

---

Cluster 1 of the #1294 relocation epic; sibling of #2298 / #2300. Prep research:
[we:reports/2026-07-09-webtraits-webcases-placement-cascade.md](../reports/2026-07-09-webtraits-webcases-placement-cascade.md);
research topic [`webtraits-webcases-placement-cascade`](/research/webtraits-webcases-placement-cascade/).
