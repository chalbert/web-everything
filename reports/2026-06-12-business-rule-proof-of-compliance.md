# Prior-art survey — business-rule manager with proof of compliance (backlog #093)

**Date:** 2026-06-12 · **For:** decision item [#093](../backlog/093-business-rule-manager-proof-of-compliance.md)
· **Published as:** `/research/business-rule-proof-of-compliance/`

/ prep pass (`/prepare 093`) — autonomous research half of the decision. Surveys the policy-as-code,
business-rules-notation, and tamper-evident-audit prior art so #093's three forks (home + rule meta-schema
· proof format & trust model · enforcement seam) are grounded before the human call. No ruling made; item
stays `open + preparedDate`.

## The gap

#093 is a Plateau offering to **author, version, govern, and enforce business rules declaratively — and
emit an auditable *proof of compliance* that the rules were applied.** Business rules are broader than
input validation ("orders over $X need approval", "EU users require consent"). The differentiator is the
proof: not "the rule exists," but "here is the record proving it ran" — what regulated enterprises
(finance, healthcare, GDPR, accessibility) produce for auditors. The item names three forks; this survey
grounds them in open standards so WE adopts vocabulary rather than coining it.

## What the survey found

### 1 · Rule meta-schema — two open standards, two audiences

- **[DMN — Decision Model and Notation](https://www.omg.org/dmn/) (OMG).** The open standard for
  declarative business rules: business-friendly **decision tables** + a standard expression language
  (FEEL), so business users express "orders over $X need approval" as Excel-like models. Complementary to
  BPMN/CMMN; implemented by Drools, Trisotech, OpenRules. This is the **authoring** vocabulary — exactly
  #093's "declarative business rules, version + scope per tenant."
- **[Open Policy Agent (OPA) / Rego](https://www.openpolicyagent.org/).** Policy-as-code, developer-
  oriented: a **Policy Decision Point (PDP)** evaluates Rego against input; the integrating service is the
  **Policy Enforcement Point (PEP)**; **decision logs** store every evaluation result ("exactly why a
  decision was made," replayable). This is the **enforcement + audit** architecture.

The two aren't rivals — they answer different forks: **DMN is the rule meta-schema** (authoring), **the
OPA PDP/PEP + decision-log pattern is the enforcement seam + proof content.** WE's "standardize the
meta-schema, not the rule list" doctrine (the intents principle) points at adopting DMN's vocabulary for
authoring. Separate-and-decouple cuts the home question: input invalidity (`webvalidation`) is a *different
concern* from domain policy — business rules earn their own home, not a `webvalidation` extension.

### 2 · Proof & trust — a known tamper-evidence ladder, anchored to webtraces

Tamper-evident audit logs are a solved design with graded strength:

- **Hash chain** — each record includes a SHA-256 over its own data + the previous record's hash;
  "impossible to modify or delete historical actions without breaking the chain." The baseline.
- **[Merkle tree](https://www.designgurus.io/answers/detail/how-do-you-design-tamperevident-audit-logs-merkle-trees-hashing)** —
  build a tree over entries: append-only, and an inclusion proof is O(log n) hashes, not the full log.
- **[Transparency log](https://transparency.dev/)** — anchor the Merkle root in a trusted/external
  location (the Certificate-Transparency model) for third-party verifiability. Blockchain is the heavy
  end of the same spectrum — flagged in the field but overkill for most.

The **content** of each proof record is an OPA-style decision log (the rule, the inputs, the verdict, the
actor/time), **anchored to a [webtraces](src/_data/projects.json) span** — the item's "the trace proving
it ran." The compliance-artifact *framing* is **[OSCAL](https://www.thoughtworks.com/radar/languages-and-frameworks/open-security-control-assessment-language-oscal)**
(NIST's machine-readable compliance format; Trestle runs it as compliance-as-code in git/CI) — a
machine-readable, auditor-acceptable proof bundle. So the proof = **a hash-chained (→ optionally Merkle/
transparency-anchored) signed decision log over webtraces, expressed in an OSCAL-aligned artifact.** How
far up the tamper-evidence ladder to go is the one genuinely market-driven judgment.

### 3 · Enforcement seam — the OPA PDP/PEP split, observed at a trace point

OPA's architecture answers "where are rules applied + where is enforcement observed": a **decision point**
(PDP) evaluates the rule; **enforcement points** (PEP) attach to actions/components and enforce the
verdict; the interaction is **logged** (the proof + trace point). Enforcement venues — build-time / runtime
/ gate — are not exclusive; OPA runs in CI/CD, gateways, and embedded at runtime. Most-permissive default:
support multiple venues, with **runtime as the baseline** because that is where the proof-of-application
is emitted (a build-time-only rule can't prove it ran for a given user/action).

## Forks this grounds (see the item for options + defaults)

1. **Home + rule meta-schema** — a new project (`webpolicy`/`webrules`) adopting DMN as the rule vocabulary
   vs extending `webvalidation`.
2. **Proof format & trust model** — hash-chained signed decision log over webtraces, OSCAL-aligned;
   Merkle/transparency-log anchoring as the strength dial (the divergent call).
3. **Enforcement seam** — the OPA PDP/PEP split, runtime as the baseline proof-emitting venue, build-time/
   gate as additional venues.

## Sources

- [OMG DMN](https://www.omg.org/dmn/) · [Drools DMN docs](https://docs.drools.org/latest/drools-docs/drools/DMN/index.html)
- [Open Policy Agent](https://www.openpolicyagent.org/) · [OPA docs](https://www.openpolicyagent.org/docs)
- [Tamper-evident audit logs — Merkle/hashing](https://www.designgurus.io/answers/detail/how-do-you-design-tamperevident-audit-logs-merkle-trees-hashing) · [transparency.dev](https://transparency.dev/)
- [OSCAL (Thoughtworks Radar)](https://www.thoughtworks.com/radar/languages-and-frameworks/open-security-control-assessment-language-oscal) · [oscal-compass/compliance-trestle](https://github.com/oscal-compass/compliance-trestle)
