---
kind: story
size: 2
parent: "181"
status: open
humanGate: { kind: review, what: "Pre-sale legal & business-protection review (entity, trademark registration, commercial license, EULA, E&O, DPA) — a professional/human action, not agent-doable; required before charging money. The free-deploy hygiene half was split to #2363." }
dateOpened: "2026-06-08"
tags: [monetization, legal, trademark, entity, eula, insurance, compliance, solo-founder]
crossRef: { url: /backlog/098-licensing-strategy/, label: "Licensing strategy (#098)" }
---

# Legal & business-protection review — the pre-sale professional pass (charging-money half)

Not a product phase but a **prerequisite to charging money**: the subset of legal
protection gated by **first paid sale**, sequenced before revenue. Keep it
low-bottleneck — a one-off professional review, not ongoing.

> **Scope split (2026-07-09).** This item used to lump together *everything* legal.
> The half gated by **any public deploy** (privacy notice, LICENSE present, name
> *clearance*) — which a free WE-only deploy needs and which is agent-draftable — was
> split out to [#2363](/backlog/2363-public-deploy-legal-hygiene-what-a-free-we-only-deploy-actua/),
> homed under the public-rollout epic ([#1104](/backlog/1104-publish-the-website-publicly-gated-controlled-rollout/)).
> What stays here is only the **paid-sale professional review** below — genuinely
> deferred human professional-services work, kept parked behind product maturity.

Checklist to review and settle (all gated by charging money):

- **Legal entity** — form one before taking payment (liability shield, clean IP
  + revenue ownership). Jurisdiction/type TBD.
- **Trademark registration** — file our own marks ("Web Everything" / "Plateau" /
  Frontier UI) + secure domains + handles. (Non-infringement *clearance* — the cheap
  pre-branding knock-out — lives in #2363.)
- **OSS + commercial license split** — the policy is its own decision in
  [#098](/backlog/098-licensing-strategy/) (the [monetization](docs/agent/platform-decisions.md#monetization) rule); settle before launch and label tiers
  honestly. (A LICENSE merely *being present* is #2363.)
- **ToS / EULA (product)** — required to sell a licensed tool. A merchant-of-record
  ([#183](/backlog/183-payments-merchant-of-record/)) offloads some compliance here.
  (The free-site privacy notice is #2363.)
- **Insurance** — professional liability / E&O; revisit as deal size grows.
- **Data processing / DPA** — ready if any customer data touches our systems
  (license endpoint, telemetry); minimise data to minimise this.

## Done when

**No tier-1 criterion is possible here, and none is invented.** Every line item above is a human
professional-services action — forming a legal entity, filing trademarks, retaining counsel for a commercial
licence and EULA, buying E&O cover, executing a DPA. None of it produces a repo artifact, a command, or a
state a script can read, so there is nothing to make green. The `humanGate: { kind: review }` already in this
card's frontmatter is the machine-readable form of that exemption; this section states it in words so the
#2949 bar is met by an honest exemption rather than a manufactured check.

What stands in for proof is a **recorded outcome per checklist line** — each written on this card, and each a
fact someone can look up rather than a judgment to re-litigate:

- **Legal entity** — the entity type + jurisdiction formed (with its registration number), or the recorded
  decision to trade personally and why.
- **Trademark registration** — per mark ("Web Everything" / "Plateau" / Frontier UI): the application serial
  number, or a recorded decision not to file. (Non-infringement *clearance* is #2363, not here.)
- **OSS + commercial licence split** — settled by ratifying [#098](/backlog/098-licensing-strategy/); this card
  records only that the ruling was applied and the tiers labelled to match it.
- **ToS / EULA** — counsel-reviewed documents exist, with the merchant-of-record split against
  [#183](/backlog/183-payments-merchant-of-record/) stated.
- **Insurance** — an E&O policy bound, or a recorded decision to defer naming the deal-size threshold that
  would reopen it.
- **DPA** — a template exists and the data-minimisation position is written down, or it is recorded that no
  customer data touches our systems at all.

Done when all six carry a recorded outcome here. That is deliberately a tier-3 bar — a prose claim plus the
exact place to look, which is this card's own checklist — because the work is not code and pretending
otherwise would be worse.

**One gate before any of it:** re-read the note below. If launch is not actually near, the correct move is to
leave this parked, not to start it.

## Note (2026-06-11, updated 2026-07-09)
**Parked** — not agent-ready. Every line item here (form a legal entity, file
trademarks, retain counsel for the product EULA + commercial license, buy E&O
insurance, DPA) is a **human professional-services action**, not code a batch agent
can execute; the body itself frames it as *"a one-off professional review."* Deferred
to the pre-launch window (sequence alongside the rest of the #181 infra once #097 picks
the MVP). Resurface when launch is actually near. **The near-term, agent-doable hygiene
that a free public deploy needs is no longer trapped in here — it's #2363.**

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: prove the premise by mutation or reversion first) — The card's premise — that zero checklist lines can carry a tier-1/tier-2 criterion — checks out against we:docs/agent/backlog-workflow.md's #2949 determinism-ladder section and the card's own we:humanGate: { kind: review } frontmatter (a valid HUMAN_GATE_KINDS value per we:src/_data/backlog.js:250), which independently already keeps this item demoted out of Tier A (we:scripts/check-standards.mjs:620-624, we:src/_data/__tests__/tier.test.ts:81). This is a documentation cross-check, not a runtime behavior, so no mutation probe applies.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Status stays `open` with `humanGate` set rather than `status: parked` (the repo's other machine-readable escape hatch, we:docs/agent/backlog-workflow.md:56, gated by we:scripts/check-standards.mjs's parkedReason rule) — correct choice, since we:src/_data/backlog.js:190/215/458 demotes a humanGate'd open item out of Tier A and the selector surfaces it under 'Held — awaiting a human action' (we:scripts/check-readiness.mjs:330-335) instead of silently looking like agent-ready work.

**Corrections recommended:**

- none — the preparation held up as written.

_Recorded through the declared `review-prep` operation._
