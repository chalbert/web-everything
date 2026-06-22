---
kind: decision
size: 3
status: parked
parkedReason: deferred
preparedDate: "2026-06-22"
relatedProject: webcompliance
dateOpened: "2026-06-18"
tags: [compliance, conformance, monetization, plateau, managed-offering]
---

# Where does hosted WE-compliance validation live: plateau-app domain vs its own project

Decide the home for a HOSTED WE-compliance validation product ("WE Compliance by Plateau" — upload a
design system, get a conformance report/badge/dashboard).

## Grounding digest

- The hosted PRODUCT's *layer* is already settled — a Plateau-layer managed offering per the
  [constellation-placement](docs/agent/platform-decisions.md#constellation-placement) rule
  (#091 managed-offerings → plateau-app; #899 behavioral conformance = plateau in-browser tool over WE
  vectors; #475 a capability is a Plateau service WE consumes as a [no-leakage client](docs/agent/platform-decisions.md#no-leakage-client)).
- The conformance STANDARD (vectors, the #891 runner, gate definitions, WE's own self-gate) **stays in WE
  and cannot move** (#855 B2; WE can't depend on Plateau to validate itself — circular).
- The portable conformance **engine** (#891) runs *consumer-side* (FUI per #954, or anywhere) — so the
  hosted product need **not** execute uploaded code server-side.
- No new `/research/` topic — this is a layer-2 *granularity* placement call over already-ruled ground
  (#091/#899/#475/#855), ratified against the structural-property monetization rule.

## The three layers (only layer 3 is in question)

1. **The conformance standard** — vectors, the #891 runner, gate definitions, WE's self-gate. **Stays in
   WE; cannot move.** Not in scope.
2. **The portable conformance engine** — the runner executing vectors against a subject; a WE-owned
   standard artifact (#891) that runs consumer-side (#954). Ships with the standard; no home of its own.
   Not in scope.
3. **A hosted validation PRODUCT** — "upload your design system → conformance report / badge / dashboard."
   *This* is "WE Compliance by Plateau", and the only open question. Already assigned to the Plateau layer;
   the remaining call is its **granularity**: a plateau-app domain vs its own project.

## Axis framing — granularity of the Plateau-layer home

The axis is *how separated* the hosted product is within the Plateau layer. The standing
[bias-toward-separation](docs/agent/platform-decisions.md) rule puts the burden of proof on **combining**
(default A folds it into plateau-app), and the [monetization](docs/agent/platform-decisions.md#monetization)
rule says decide on a **structural property** (independent deploy / credential-holding) — *never* on
appetite or operational cost. So the default cannot rest on "cheapest for a solo dev" (that is
prioritization, the forbidden basis); it must rest on the structural fact that, *today*, the product can
share plateau-app's tenant identity and hold no per-uploader credentials of its own — and it must sit
behind the #475 no-leakage service-client seam so the eventual split stays mechanical.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **Fork 1** — granularity of the Plateau-layer home | **(a) plateau-app domain** *iff* it shares plateau-app tenant identity/auth, holds no per-uploader credentials, and sits behind the #475 service-client seam | (b) its own constellation repo/project — fired the moment a structural trigger (independent deploy cadence or uploader-specific credentials) appears | **med-high** — structural test is clear; the trigger is what's demand-gated |

## Fork 1 — granularity of the Plateau-layer home

**Fork-existence justification:** genuine either/or — a product has *one* home; "a domain inside
plateau-app" and "its own constellation project" are mutually-exclusive structural placements that cannot
coexist. Both are coherent (it's a real A/B, not a forced invariant); under bias-toward-separation the
burden of proof is on the *combining* branch (a), which the structural test below discharges.

**Crux:** the [monetization](docs/agent/platform-decisions.md#monetization) rule forbids deciding the home
on cost/appetite; it must turn on a **structural property** — does this product *today* hold independent
deploy/credential state, or can it share plateau-app's?

**Options:**

- **(a) plateau-app domain** *(recommended default — on the structural test, not cost)* — build it as a
  domain inside plateau-app, exactly like the Technical Configurator and the landed webvalidation domain
  (#725), consuming WE vectors + runner as a [no-leakage Plateau service client](docs/agent/platform-decisions.md#no-leakage-client)
  (#475). **Choose (a) iff:** the product shares plateau-app's tenant identity/auth **and** issues no
  per-uploader credentials of its own, **and** it sits behind the #475 service-client seam (its own data
  store, wire-protocol-only coupling) so a later lift-out is mechanical. The conformance engine runs
  consumer-side (#891/#954), so (a) does **not** require executing untrusted uploads in plateau-app's
  process.
- **(b) Its own repo/project in the constellation** — *Rejected for now, but trigger-armed.* Justified the
  moment a **structural** trigger fires: the product earns an independent deploy/lifecycle cadence, or it
  holds uploader-specific credentials/state. At that point the bias-toward-separation burden flips and (b)
  wins — re-decide, don't grandfather (a).

**Recommended default: (a) plateau-app domain, gated on the structural test above.**

**Skeptic:** SURVIVES-WITH-AMENDMENT → the skeptic's strongest hit lands: the original lean rested on
"lowest operational cost / solo-dev / single-service," which is **prioritization**, the exact basis the
monetization rule forbids — an un-discharged bias-toward-separation burden wearing a default's clothes.
**Amendment folded in:** the default now rests on a **structural test** — choose (a) *iff* the product
shares plateau-app tenant identity/auth AND issues no per-uploader credentials of its own AND sits behind
the #475 no-leakage service-client boundary; "lowest operational cost" is demoted from rationale to
tie-breaker only. The blast-radius attack (running untrusted uploads in-process) is **defused** by the
consumer-side engine (#891/#954) — server-side execution is a build-detail, not a granularity argument. The
migration-tax attack is closed by mandating the #475 seam from day one, keeping the eventual (b) split
mechanical.

## On resolve (when unparked + ratified)

- Confirm layers 1–2 stay WE (restating, not deciding).
- Apply the structural test → pick (a) or (b) for layer 3; if (a), file the plateau-app domain build
  behind the #475 seam; if (b), file the constellation project-creation item.
- `codifiedIn`: a hosted validation product is a Plateau managed offering consuming WE vectors as a
  no-leakage client; standard/engine never leave WE.

## Parked — demand-gated

Parked `deferred`: no appetite demonstrated yet for a hosted compliance product distinct from Web Docs
(#091). The fork is at DoR now (prepared, structural test stated); **un-park** when a user/market signal
shows a standalone compliance-validation surface is wanted — the home call is then a fast ratify against
the structural test above.
