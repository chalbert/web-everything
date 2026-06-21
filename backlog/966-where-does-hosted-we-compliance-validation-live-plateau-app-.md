---
kind: decision
size: 3
status: parked
parkedReason: deferred
relatedProject: webcompliance
dateOpened: "2026-06-18"
tags: [compliance, conformance, monetization, plateau, managed-offering]
---

# Where does hosted WE-compliance validation live: plateau-app domain vs its own project

Decide the home for a HOSTED WE-compliance validation product ("WE Compliance by Plateau" — upload a
design system, get a conformance report/badge/dashboard). The conformance STANDARD (vectors, the #891
runner, gate definitions, WE's own self-gate) stays in WE and cannot move (#855 B2; WE can't depend on
Plateau to validate itself). The hosted PRODUCT is a Plateau-layer managed offering per the [Constellation placement](docs/agent/platform-decisions.md#constellation-placement) rule (#091/#899/#475).
Open call: make it a plateau-app DOMAIN first (like the Technical Configurator / webvalidation), or stand
up its own repo. Lean domain-first; graduate only when deploy/lifecycle diverge or it becomes a primary
revenue line (soft/monetization-revisitable). Parked until product appetite shows.

> **Parked — demand-gated.** No appetite demonstrated yet for a hosted compliance product distinct
> from Web Docs (#091). Unpark when a user/market signal shows a standalone compliance-validation
> surface is wanted; the home call below is then a fast ratify.

## The three layers (only layer 3 is in question)

"Compliance validation" lumps three things that land in different homes — separating them is the
whole point:

1. **The conformance standard** — vectors, the #891 runner, gate definitions, and WE's own self-gate
   (the `check:standards` gate, the #817 WE-side gate). **Stays in WE; cannot move.** It *is* WE
   ("WE = contracts + conformance only", #855 B2), and WE cannot depend on Plateau to validate itself
   (circular; breaks self-containment). Not in scope of this decision.
2. **The portable conformance engine** — the runner executing vectors against a subject. Already a
   WE-owned standard artifact (#891) that runs *consumer-side* (FUI per #954, or anywhere). Ships with
   the standard; has no home of its own. Not in scope.
3. **A hosted validation PRODUCT** — "upload your design system → conformance report / badge /
   dashboard." *This* is "WE Compliance by Plateau", and the only open question. Already assigned to the
   Plateau layer by #091 (managed offerings → plateau-app), #899 (behavioral conformance = plateau
   in-browser tool over WE vectors), #475 (a capability is a Plateau service WE consumes as a
   no-leakage client). The remaining call is its *granularity*: a domain vs its own project.

## The fork — granularity of the Plateau-layer home

- **A — plateau-app domain (default, ~80%).** Build it as a domain inside plateau-app, exactly like
  the Technical Configurator and the just-landed webvalidation domain (#725). Consumes WE vectors +
  runner as a [no-leakage Plateau service client](docs/agent/platform-decisions.md#no-leakage-client) (#475). Lowest operational cost for a solo dev; the [monetization](docs/agent/platform-decisions.md#monetization) ranking
  favors "self-run tool / single service" over standing up new infrastructure (see #089-#093).
- **B — its own repo/project in the constellation.** Justified only once it earns an independent
  deploy/lifecycle or becomes a primary revenue line. Bias-toward-separation governs *modules*; a new
  top-level constellation project carries a higher bar (operational cost, another repo to run). The
  residual is monetization-shaped (soft, revisitable) — decide on a structural property (independent
  deploy / credential-holding), never on appetite alone.

## On resolve (when unparked + ratified)

- Confirm layers 1–2 stay WE (restating, not deciding).
- Pick A or B for layer 3; if A, file the plateau-app domain build; if B, file the constellation
  project-creation item.
- `codifiedIn`: a hosted validation product is a Plateau managed offering consuming WE vectors as a
  no-leakage client; standard/engine never leave WE.
