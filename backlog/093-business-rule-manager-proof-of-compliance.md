---
type: decision
workItem: story
size: 8
parent: "089"
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "project:webpolicy"
preparedDate: "2026-06-12"
relatedReport: reports/2026-06-12-business-rule-proof-of-compliance.md
tags: [monetization, business-model, plateau, platform-manager, business-rules, compliance, audit, webvalidation, webtraces, webexpressions, governance, enterprise]
relatedProject: webvalidation
crossRef: { url: /research/business-rule-proof-of-compliance/, label: "Business-rule + proof survey" }
---

# Business-rule manager with proof of compliance — a Plateau offering

## Ruling (2026-06-12) — RESOLVED

Decided in session `093-business-rule-manager-proof-of-compliance`. All three forks ratified:

- **Fork 1 (home + meta-schema): RATIFIED — new project `webpolicy` adopting DMN.** Domain policy is a
  different concern from input invalidity (separate-and-decouple), so it earns its own home composing
  `webvalidation`/`webexpressions`/`webcontexts`/`webtraces`, not a `webvalidation` extension. Adopt DMN's
  vocabulary (standardize the meta-schema, not the rule list). **Name = `webpolicy`** (the broader umbrella —
  access/consent/governance/accessibility, the proof targets the item names — over the narrower `webrules`;
  composes with #092 governance + #338 access-control). *Sub-decision ratified:* rule authoring surfaces as a
  Technical Configurator domain (plateau-app).
- **Fork 2 (proof format & trust model): RATIFIED — A\* (raised baseline).** Hash-chained, signed decision
  log over `webtraces`, OSCAL-aligned, as the strength-dial architecture — **but the baseline includes
  lightweight external anchoring** (periodic Merkle-root checkpoint to a running transparency log, e.g.
  [Sigstore Rekor](https://docs.sigstore.dev/logging/overview/)), not just internal hash-chaining. Rationale:
  for a proof-of-compliance product targeting finance/healthcare/GDPR, *third-party verifiability is the
  credibility floor, not an upgrade* — internal-only tamper-evidence a skeptical auditor can dismiss
  ("you could have regenerated the chain"). Full per-record inclusion proofs / blockchain stay the opt-in top
  of the dial. (Same "don't make the load-bearing property opt-in" move as #364's Fork 4 A′.) **If the initial
  market turns out lighter-compliance, the dial drops to bare-A — the architecture is unchanged.**
- **Fork 3 (enforcement seam): RATIFIED — OPA PDP/PEP, runtime baseline.** Decision point evaluates against
  `webcontexts`; enforcement points attach to actions/components; the interaction logs at a `webtraces` span
  (the proof point). Runtime is the baseline (only venue that proves a rule ran *for a given user/action*);
  build-time/gate are additional venues. WE adopts the **PDP/PEP pattern** — the policy *language* (OPA/Rego
  vs [Cedar](https://www.cedarpolicy.com/)) is a downstream build choice, not fixed here.

**Graduation:** spin-off `blockedBy` chain — `webpolicy` rule-manager (Forks 1, DMN meta-schema) →
proof-of-compliance (Fork 2, A\* hash-chain + signature + external anchoring, OSCAL) → enforcement (Fork 3,
PDP/PEP runtime). `graduatedTo: webpolicy`.

---

**Prepared decision — ratified 2026-06-12 (was: ready to ratify).** No design exists yet; this is a Plateau offering to **author,
version, govern, and enforce business rules declaratively — and emit an auditable *proof of compliance*
that the rules were applied** (the differentiator: not "the rule exists," but "here is the record proving
it ran"). The three forks below are grounded in a prior-art survey published as
[`/research/business-rule-proof-of-compliance/`](/research/business-rule-proof-of-compliance/) (session
report `we:reports/2026-06-12-business-rule-proof-of-compliance.md`) covering DMN, Open Policy Agent, the
tamper-evident-audit ladder, and OSCAL. Each fork carries a **bold** default; the survey's key finding is
that two open standards answer *different* forks (DMN = authoring vocabulary; OPA PDP/PEP = enforcement +
proof), so WE adopts rather than coins.

## The axis

The concern decomposes into the three axes the item named: **home + rule meta-schema** (how rules are
expressed and where the standard lives), **proof format & trust model** (what makes a proof auditor-
acceptable), and **enforcement seam** (where rules apply + where enforcement is observed). The platform
already has the substrate the item lists — `webvalidation` (input invalidity), `webexpressions`
(conditional logic), `webcontexts` (scoped policy flow), `webreliability` (failure handling), `webtraces`
(execution-flow monitoring, W3C Trace Context / OpenTelemetry). The survey maps each fork onto an open
standard: **DMN** (OMG decision tables) for authoring, the **OPA Policy-Decision-Point / Policy-
Enforcement-Point + decision-log** pattern for enforcement + proof content, the **hash-chain → Merkle →
transparency-log** ladder for tamper-evidence, and **OSCAL** for the compliance-artifact framing — proof
records anchored to [webtraces](src/_data/projects.json) spans.

### Per-fork classification (the 7-question pass, recorded)

- **Layer (Q1):** the rule *meta-schema* + proof *format* are **standard/protocol** concerns (a vocabulary
  + a contract); the managed authoring/governance UI + hosted proof store are the **Plateau product**.
- **Protocol or not (Q2):** the proof format has a real cross-vendor verifiability story (an auditor /
  third party must verify a proof produced by WE) — a legitimate **Protocol**, but built on the existing
  `webtraces` contract, not a fresh one → **Fork 2**.
- **Separate-and-decouple / seam (Q7):** input invalidity (`webvalidation`) is a *different concern* from
  domain policy — burden of proof is on combining, and it isn't met → business rules earn their **own
  home** → **Fork 1**.
- **Standardize the meta-schema, not the list (intents doctrine):** adopt **DMN's** rule vocabulary rather
  than coin a WE rule language → **Fork 1**.
- **Most-permissive default (Q6):** enforcement venues aren't exclusive — support build-time / runtime /
  gate, with **runtime as the baseline** (the only venue that can prove a rule ran for a given user/action)
  → **Fork 3**.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · Home + rule meta-schema** | **New project (`webpolicy`/`webrules`) adopting DMN** as the rule vocabulary | Extend `webvalidation` with a rules layer | Med-high |
| **2 · Proof format & trust model** | **Hash-chained, signed decision log over webtraces, OSCAL-aligned** | Transparency-log / blockchain-anchored from day one | **Low — market-driven** |
| **3 · Enforcement seam** | **OPA PDP/PEP split; runtime as the baseline proof-emitting venue**, build-time/gate as additional | Build-time / gate-only enforcement | High |

## Fork 1 — Home + rule meta-schema

**Crux:** where the standard lives, and what vocabulary expresses a rule. The survey found two open
standards for two audiences — DMN (business-friendly decision tables, the *authoring* layer) and OPA/Rego
(developer policy-as-code, the *enforcement* layer).

- **A. A new project (`webpolicy`/`webrules`) adopting DMN as the rule meta-schema.** Domain policy
  ("orders over $X need approval") is broader than input invalidity; a dedicated home keeps it decoupled
  from `webvalidation`. Define the **rule meta-schema** (the DMN-aligned vocabulary), not the rule list —
  mirroring the intents "standardize the meta-schema" principle. *Sub-decision:* rule authoring is a natural
  **Technical Configurator domain** (plateau-app) — the data-driven decision tool already hosts domains
  (file-upload added); a rules domain fits, so authoring surfaces there.
- **B. Extend `webvalidation` with a business-rules layer.** Reuses the validity/commitment substrate, but
  *Rejected as the home* — conflates input invalidity (a field is wrong) with domain policy (an action is
  disallowed); violates separate-and-decouple. `webvalidation` remains a *composed dependency*, not the
  home.

**Recommended default: A — a new project adopting DMN.** Domain policy is its own concern with its own
open vocabulary; a dedicated home composes the existing substrate (`webvalidation`/`webexpressions`/
`webcontexts`/`webtraces`) without absorbing into it. **Confidence: med-high** — the one judgment is the
project *name/boundary* (is "policy" the right scope, or narrower "business-rules"); the home-as-separate
call itself is firm.

## Fork 2 — Proof format & trust model

**Crux:** what makes a proof-of-compliance artifact tamper-evident and auditor-acceptable — and *how
strong* the tamper-evidence must be. This is the revenue driver and the fork the field genuinely grades.

- **A. Hash-chained, signed decision log over webtraces, OSCAL-aligned.** Each proof record (rule, inputs,
  verdict, actor, time) is an OPA-style decision log entry anchored to a `webtraces` span; records are
  **SHA-256 hash-chained** (append-only, can't be altered without breaking the chain) and **signed**; the
  bundle is expressed in an **OSCAL-aligned** machine-readable compliance artifact. Native-first-ish: built
  on the existing trace contract, no exotic infrastructure.
- **B. Merkle-tree / transparency-log anchored** (or blockchain) **from day one.** Adds O(log n) inclusion
  proofs + external/third-party verifiability — stronger, but heavier to operate, and unnecessary until a
  customer's auditor demands external anchoring. *Concrete path:* a running append-only transparency log
  ([Sigstore Rekor](https://docs.sigstore.dev/logging/overview/), Trillian-backed) — external verifiability
  **without** building blockchain infra, which is what makes a raised baseline (A\*) practical.
- **C. Unsigned plain trace log.** *Rejected* — not tamper-evident; fails the "proof," which is the entire
  value.

**Recommended default: A — hash-chained signed decision log over webtraces, OSCAL-aligned, with Merkle/
transparency-log anchoring as an opt-in strength dial.** Start at the baseline that is genuinely tamper-
evident (hash chain + signature) and expose the upgrade (Merkle inclusion proofs → external transparency-
log anchoring) as a configurable strength level for customers whose auditors require it. **Confidence:
low / market-driven** — this is the fork where the decider's read on the *regulatory bar* matters; if the
target market (finance/healthcare) demands externally-verifiable proofs out of the gate, B becomes the
default. Flagged as the one row to scrutinize.

## Fork 3 — Enforcement seam

**Crux:** where rules attach to actions/components and where enforcement is observed (the trace/proof
point). OPA's PDP/PEP architecture is the field's answer.

- **A. OPA PDP/PEP split; runtime as the baseline proof-emitting venue.** A **decision point** evaluates the
  rule (against `webcontexts` data); **enforcement points** attach to actions/components and enforce the
  verdict; the interaction is logged at a **`webtraces` span** (the proof point). Build-time and gate venues
  are *also* supported (CI checks, deploy gates), but **runtime is the baseline** because only runtime can
  prove a rule ran *for a given user/action*.
- **B. Build-time / gate-only enforcement.** *Rejected as the baseline* — can assert a rule *exists* but
  cannot emit proof-of-application per action/user, which is the product. Kept as an *additional* venue.

**Recommended default: A — OPA PDP/PEP, runtime baseline, build-time/gate as additional venues.** Most-
permissive (support all venues) with runtime as the proof-bearing baseline. High confidence (the PDP/PEP
pattern is the mature, well-understood answer).

---

## The two halves — context

1. **Business-rule manager.** Author domain policy declaratively, version it, scope it per context/tenant,
   enforce at runtime — composing `webvalidation`, `webexpressions`, `webcontexts`, `webreliability`,
   `webintents`.
2. **Proof of compliance.** The differentiator: an auditable, tamper-evident record (on `webtraces`) that a
   rule was evaluated + enforced for a given action/user/time — what regulated enterprises (finance,
   healthcare, GDPR/consent, accessibility) must produce for auditors.

## Why Plateau / no lock-in — context

Compliance is an existing budget line (rule engines + audit trails). Rules-as-providers/policies resolve
through the introspectable registries/contexts; proof is traces — same substrate as the relationship graph
([#092](/backlog/092-provider-consumer-graph-platform-manager/)) and verification (#089 idea 1). The rule
vocabulary + proof format are **open** (free); the **licensed product** is the managed authoring + governance
UI + the hosted tamper-evident proof store. Rules and proofs are portable; nothing is withheld.

## References

Grounded in the [prior-art survey](../reports/2026-06-12-business-rule-proof-of-compliance.md) (published as
[`/research/business-rule-proof-of-compliance/`](/research/business-rule-proof-of-compliance/)). External
sources, by fork:

**Rule meta-schema (Fork 1) — authoring vocabulary**
- [OMG DMN — Decision Model and Notation](https://www.omg.org/dmn/) (decision tables + FEEL) · [Drools DMN docs](https://docs.drools.org/latest/drools-docs/drools/DMN/index.html)

**Enforcement seam (Fork 3) — PDP/PEP pattern**
- [Open Policy Agent](https://www.openpolicyagent.org/) ([docs](https://www.openpolicyagent.org/docs)) — the canonical PDP/PEP + decision-log reference (CNCF graduated)
- [AWS Cedar](https://www.cedarpolicy.com/) / [Amazon Verified Permissions](https://aws.amazon.com/verified-permissions/) — *alternative* PDP/PEP impl (app-level, deny-by-default, formally verified). Fork 3 adopts the **pattern**, so the policy *language* (Rego vs Cedar) stays a downstream build choice.

**Proof format & trust model (Fork 2) — tamper-evidence ladder**
- [Tamper-evident audit logs — hash chains & Merkle trees](https://www.designgurus.io/answers/detail/how-do-you-design-tamperevident-audit-logs-merkle-trees-hashing) · [transparency.dev](https://transparency.dev/) (Certificate-Transparency model = third-party verifiability)
- [Sigstore Rekor](https://docs.sigstore.dev/logging/overview/) ([sigstore/rekor](https://github.com/sigstore/rekor)) — a **running** append-only transparency log (Trillian-backed). The concrete external-anchoring target that makes **A\*** feasible without blockchain infra.
- [OSCAL (Thoughtworks Radar)](https://www.thoughtworks.com/radar/languages-and-frameworks/open-security-control-assessment-language-oscal) · [oscal-compass/compliance-trestle](https://github.com/oscal-compass/compliance-trestle) — machine-readable, auditor-acceptable compliance-artifact framing

---

*Graduation (on ratification):* once the three forks settle, the item slices into **rule-manager →
proof-of-compliance → enforcement** via a `blockedBy` chain — a prepared decision yields agent-ready builds,
not code itself.
