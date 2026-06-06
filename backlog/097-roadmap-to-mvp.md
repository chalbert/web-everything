---
type: decision
status: open
dateOpened: "2026-06-06"
tags: [roadmap, mvp, go-to-market, ci, auth, licensing, payments, distribution, marketing, legal, trademark, insurance, monetization, solo-founder]
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Product ideas (#089)" }
---

# Roadmap to MVP — first paid product + the scaffolding to ship it (CI, auth, payments, distribution, marketing)

The path from "ideas catalogued" to **one shipped, paying product**, run by a
single person. Sequencing is governed by the solo-founder lens in
[#089](/backlog/089-monetization-product-ideas/): **lowest operational burden
first** — a tier-1 *self-run tool* with **bring-your-own-AI** (no model cost, no
uptime, no support SLA). This item is the self-contained plan; sub-items get their
own write-ups as they start.

## MVP product choice (recommendation in bold)

**Flagship = the AI code-tool family on the shared `webadapters` core, shipped as
one licensed self-run CLI.** All three of mockup→code ([#086](/backlog/086-mockup-to-standard-code-tool/)),
upgraders ([#094](/backlog/094-ai-upgrader-tools/)), and the conformance auto-fix
agent ([#095](/backlog/095-conformance-auto-fix-agent/)) share ~80% of one engine:
*input adapter → neutral structure → verify-gated generation*. **Ship the engine +
one input adapter first**, then add the others as adapters — not separate products.

- **Recommended first input adapter:** start with the one that best demos the
  "propose-and-verify" moat with least model risk. Candidates: mockup→code (best
  "wow"), upgrader (clearest enterprise pain), auto-fix (tightest verify loop).
  *Open — pick one; the engine is shared regardless.*

## Phases

**Phase 0 — Decide & scaffold**
- Pick the first input adapter (above).
- **Open-core split:** engine/standard stay open; decide where the *licensed* CLI
  lives (new repo vs. Frontier UI vs. Plateau) and what's open vs. closed.
- Pricing shape (per-seat / per-repo; subscription vs. perpetual+updates).

**Phase 1 — The MVP tool**
- Build the self-run CLI on the `webadapters` AST core + analyzer/provider
  registry + one reference AI provider (BYO key, 2–3 models behind the registry).
- **Quality gate built in:** every emitted artifact round-trips + passes
  `check:standards` before it's offered — the trust spine and the moat.
- Package as `npx`-able CLI; cross-platform; offline-friendly.

**Phase 2 — Monetization scaffolding ("CI, auth, etc.")**
- **Auth/licensing — keep it tier-1:** a **license-key** model for a self-run
  tool, *not* a hosted auth system. Signed, offline-tolerant keys with optional
  periodic phone-home. Minimal serverless endpoint for issuance/validation — the
  only always-on surface, kept tiny.
- **Payments:** lean to a **merchant-of-record (Lemon Squeezy / Paddle)** over raw
  Stripe — it handles global VAT/sales-tax, which is a real solo-founder time sink;
  webhook → license-key issuance.
- **Product CI/release:** build, test, **sign**, publish to npm, changelog, release
  artifacts. (Distinct from the conformance CI *tool* the product itself runs.)
- **Telemetry:** opt-in, privacy-first — **no source code leaves the machine**
  (non-negotiable trust point for a code tool); usage counts only.
- **BYO-AI key plumbing:** secure local key handling; provider registry is the
  swap seam.

**Phase 3 — Launch: marketing & distribution**
- **Distribution:** npm/`npx` as the primary channel; GitHub releases; a VS Code
  command later (the repo is already a VS Code extension context). Listing on
  relevant registries/marketplaces.
- **Marketing:** the **standard's own site is the top of funnel** — "the website IS
  the spec" doubles as content marketing; the tool is the conversion. Dev-first
  motion: the *propose-and-verify* demo (mockup/legacy code → provably-conformant
  output) is the hook; show, don't tell. Launch surfaces: a landing+pricing page
  (reuse **webdocs**, [#091](/backlog/091-web-docs-as-a-service-plateau/)),
  a demo video, Show HN / dev communities, conformance-as-credibility.
- **Free tier → paid:** free self-run on your own machine (limited); paid for scale
  / CI / team use — the open suite + free self-attestation feeds the funnel.
- **Support model — protect solo bandwidth:** docs-first to deflect; async/community
  (GitHub issues, Discord); **explicit no-SLA**. No live-serve dependency that can
  page you.

## Legal & business protection (parallel track — start early)

Not a product phase but a prerequisite to *charging money*; sequence alongside
Phase 0–2, much of it before first sale. Treat as a checklist to review (likely
with a one-off professional, not ongoing — keep it low-bottleneck):

- **Legal entity** — form one before taking payment (liability shield, clean
  ownership of IP and revenue). Jurisdiction/type TBD.
- **Brand protection** — trademark the product/brand name; secure domains and
  handles; confirm the name is clear before marketing spend. "Web Everything" /
  "Plateau" / Frontier UI naming clearance.
- **OSS license + commercial license** — the full split is its own decision in
  [#098](/backlog/098-licensing-strategy/): WE = Apache (pure standard), Frontier UI
  = Apache (open reference impl), Plateau = fair source ("available"), products =
  proprietary EULA. Deferred there; not short-term-critical, but settle before
  launch and keep the tiers labelled honestly.
- **Terms of Service / EULA + Privacy Policy** — required to sell; the privacy
  policy must state the telemetry stance ("no source code leaves the machine") and
  be **GDPR-compliant** (EU customers likely). A merchant-of-record (Phase 2) also
  offloads some compliance here.
- **Insurance** — professional liability / E&O; relevant once enterprises rely on
  the tool's output. Revisit as deal size grows.
- **Data processing / DPA** — if any customer data touches our systems (the
  license endpoint, telemetry), have a DPA ready; minimise data to minimise this.
- **A "legal-requirements review" pass** — a single structured review of the above
  (and tax registration via the MoR) before launch, captured as a checklist.

## Cross-cutting open decisions

- **First input adapter** (mockup vs. upgrader vs. auto-fix).
- **Open-core boundary** — what ships open vs. licensed, and the repo home.
- **License-key vs. hosted-auth** — strong recommendation: license-key (lowest ops).
- **Merchant-of-record vs. Stripe-direct** — recommend MoR for solo (tax offload).
- **Pricing** — model + tiers.
- **Telemetry stance** — confirm "no code leaves the machine" as a public promise.

## Sequencing note

Everything here is deliberately **tier-1**: the one always-on surface is the tiny
license endpoint. The bigger plays (MaaS live CDN #081, business-rule/compliance
manager #093, the relationship-graph dashboard #092) are **post-MVP** — they add
uptime/contract burden and wait until the self-run tool funds taking that on.
