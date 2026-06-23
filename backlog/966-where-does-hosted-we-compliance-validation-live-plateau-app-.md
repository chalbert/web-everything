---
kind: decision
size: 3
status: resolved
preparedDate: "2026-06-22"
relatedProject: webcompliance
dateOpened: "2026-06-18"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#compliance-validation-home"
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

## Reframe (2026-06-23) — it's a dev-browser lens, not a hosted SaaS

The original fork (plateau-app domain vs own project) presupposed a **hosted upload SaaS**. That premise
is rejected. The merit-justified form of WE-compliance validation is a **lens in the dev-browser**
(#141 Chromium/extension shell; #1636 role-scoped lenses; Plateau-layer per
[constellation-placement](docs/agent/platform-decisions.md#constellation-placement) / #1565): **we just
analyse the page in front of us.** The conformance engine already runs consumer-side
(#891/#954), so the lens runs WE vectors against the loaded subject *in the user's own browser* — no upload
service, no server-side execution, **no per-uploader credentials held by us.** Any auth needed to reach the
user's own page is the user's own credential in their own password manager; we never hold it.

This **separates two distinct products**, and only one is open:

- **(1) Self-validation lens** *(the real, non-speculative product → dev-browser)* — "analyse the page in
  front of you → conformance report." Useful to any dev, client-side, zero lock-in (a no-leakage client of
  WE vectors+runner, #475; standard+engine stay in WE, #855). **This is where compliance validation lives.**
- **(2) Trusted third-party badge/attestation SaaS** *(genuinely demand-gated)* — an independent service
  vouches to the market. A self-run lens can only self-attest, so a trusted badge is a *different* product.
  No market signal for it. **Only THIS product would ever need the plateau-app-domain-vs-own-project call**
  — and only when demanded.

**Effect on Fork 1:** superseded, not branch-picked. The a/b granularity fork applies only to product (2)
and revives if/when a hosted attestation SaaS is demanded.

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

| Fork | Ruling | Notes | Confidence |
|---|---|---|---|
| **(reframed)** home of WE-compliance validation | **dev-browser lens** (Plateau, #141/#1636) — analyse the page in front of you, client-side engine (#891/#954), no SaaS, no credentials held by us | supersedes the original a/b | **high** |
| **Fork 1** — plateau-app domain vs own project | **superseded / deferred** — applies only to a distinct hosted attestation/badge SaaS (product 2), demand-gated; revive a/b only if that product is demanded | the a/b structural test below is preserved for that future call | n/a until product 2 is wanted |

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

**Red-team at ratification (2026-06-23) — no attack lands:**

- *"A badge product is inherently credential-bearing, so the (b) trigger fires today."* A "WE-conformant"
  badge means the product signs attestations, i.e. holds a signing key. **Fails:** a badge-signing key is
  *product-level* state (plateau-app holds it like any tenant secret, as the webvalidation domain already
  does), **not** *per-uploader* credentials — the trigger is about per-uploader credential/identity state,
  of which this product still has none. Recorded so the distinction is explicit: **badge-signing alone does
  not fire the (b) trigger.**
- *"Compliance tracks WE spec versions → it needs its own deploy cadence, so (b)."* Plausible future, but no
  such cadence exists today. **Fails (deferred, not denied):** exactly what the trigger-arm catches.
- *"You're overriding a deliberate, day-old choice to hold."* **Fails:** the hold rested on "no appetite
  demonstrated yet" = demand, the forbidden basis ([judge-on-pure-merit-never-demand] #1631; monetization
  rule's "never decide on appetite"). A *placement* call is pure merit and at DoR; the legitimate deferral
  is the *build*, not the *decision*. See the reframed *Held open* section below.

## On resolve (when ratified)

- Confirm layers 1–2 stay WE (restating, not deciding).
- **Ruling:** WE-compliance validation lives as a **dev-browser lens** (Plateau, #141/#1636) that runs the
  consumer-side conformance engine (#891/#954) against the page in front of you — no hosted upload service,
  no per-uploader credentials held by us (user's own auth, their own password manager) — consuming WE
  vectors+runner as a no-leakage client (#475); standard+engine stay in WE (#855).
- The original Fork 1 (plateau-app domain vs own project) is **superseded**: it applies only to a distinct
  *hosted attestation/badge SaaS* (product 2), which is demand-gated; revive the a/b call only if that
  product is ever demanded.
- File the dev-browser conformance-lens build as its own item (lens over WE vectors via the #475 seam),
  demand-gated only on appetite for the *build*, not the placement.
- `codifiedIn`: WE-compliance validation is a **dev-browser lens** (Plateau) that analyses the page in
  front of you, consuming WE vectors+runner as a no-leakage client; standard/engine never leave WE; a
  trusted third-party badge SaaS is a separate, demand-gated product.

## The build is demand-gated — the decision is not

The earlier "held open until demand" framing demand-gated the *decision*, which is the forbidden basis
([judge-on-pure-merit-never-demand] #1631; the monetization rule's "never decide on appetite"). A placement
call is pure merit and at DoR, so the **home decision is ratified now** (see ruling below). What stays
deferred is only the **build** — filing/standing-up the plateau-app compliance domain — because building
ahead of any need is prioritization, not a merit question. This is the clean split per
[decouple-build-from-release-timing] / [separate-canonicity-from-content-freeze]: **ratify the placement
now, build later.**

**Build un-park trigger:** a user/market signal that a hosted compliance-validation surface distinct from
Web Docs (#091) is wanted. At that point the home is *already decided* (a, structural-trigger-armed) — the
only fresh call is whether a *structural* trigger has since flipped it to (b).
