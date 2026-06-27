---
name: project-monetization-strategy
description: "Revenue-stream strategy for the WE/Plateau ecosystem — open-core, solo-founder operational ranking"
metadata: 
  node_type: memory
  type: project
  originSessionId: ba90c979-3fef-49ed-a7ae-336e57c93602
---

Monetization strategy for the Web Everything / Plateau ecosystem. Captured across
backlog #089 (product ideas), #090 (consultancy), #091 (Web Docs aaS), #092
(provider↔consumer graph / platform manager), #093 (business-rule manager + proof
of compliance).

**Premise:** open source = free, paid product = **license**. Never gate the
standard or the compliance/verification tool; sell the managed/licensed layer
beside it. Non-vendor-lock is the marketing, not a constraint — "cancel and
self-host" must always hold (npm + git stay the package source; Plateau tracks
*relationships*, not bytes).

**Plateau backend phasing — no backend in MVP; capture, don't forbid (author-stated
2026-06-14).** The plateau-app "no backend" rule is a *phase* constraint, not a permanent
prohibition. Three phases: **(1) MVP/now** = browser-only, no backend, flat-cost,
**revenue-first** (ship the non-deployed shape first); **(2) full SaaS** = a hosted
multi-product suite, **PARKED** at **#554** (suite shell: account/sign-in/cross-product
billing; per-product economics #428/#451 park under it); **(3) later** = **open** to paid,
backend-backed function in the browser, deferred behind Phase-1 flat-cost priority.
Standing rule when a backend/hosted/live-serve idea surfaces: it is **out of phase, not
forbidden** — think it through and **capture it** (park under #554 or a new
`status: parked` item with `dateParked` + an "unpark when…" note), never silently drop it,
never build it before live-serve is on the roadmap. Codified in plateau-app/CLAUDE.md
("THE PHASE RULE"). Relates [[project_linear_cost_revenue_on_device]] (flat-cost floor).

**Solo-founder operational ranking (the hard prioritiser).** Nic is solo and wants
to stay solo. Low manual work + no personal bottleneck + minimal uptime/support
obligation outranks willingness-to-pay. Defer any live-serve thing that can break
and demand instant support. Delivery-shape tiers:
1. Self-run tool on the customer's dev/CI (preferred — no uptime on us).
2. A single self-hosted service we run (second).
3. Custom, configured, self-hosted at the enterprise (last — heavy contract
   negotiation + per-customer support).
**Ship the tool form before the service form.** Most ideas have both.

**Current ranking:** migration tooling (tier-1, best first bet) > verification as
CI tool > docs generator / graph-scanner CLIs > [defer] MaaS live CDN (#081) >
[latest] business-rule/compliance manager (#093) + consultancy (#090).

**Licensing gradient (backlog #098, deferred/not short-term-critical):** maps onto
the constellation — closer to the standard = more open. WE = Apache (pure
standard, incl. the open conformance suite) · Frontier UI = Apache (open reference
impl; adapters stay open) · Plateau = fair source / "available" (FSL or PolyForm
Shield, converts to Apache ~2y) · plateau-app + paid tools = proprietary EULA.
Label honestly (open vs fair-source, never open-wash). The bet: moat = platform +
propose-and-verify products, not the impl. Leverage code (MaaS host, verification
service, graph, AI CLIs) belongs under Plateau; primitives stay open in WE/FU.
CLA needed before outside contributions.

**MVP approach — emergent, not pre-picked (reframed 2026-06-08, backlog #097).**
Don't commit an MVP scope up front: the product is in flux, so work as many
candidate ideas as possible in parallel and let the MVP *emerge* from what proves
out. #097 is now a **living strategy doc** (`type: idea`, not a decision) — keep it
updated as candidates are worked. The candidate list is a **menu, not authoritative**.
**Commercialization infrastructure is decoupled** from any specific product into
its own product-agnostic epic **#181** (children #182 license-key endpoint · #183
payments/MoR · #184 marketing site · #185 go-to-market · #186 legal review). First
product candidates being worked: **#094 AI upgrader** + **#095 auto-fix agent**
(both share one engine: input adapter → neutral structure → verify-gated generation;
each its own MVP). **#086 mockup→code is deferred post-MVP** (highest model variance).

**Plateau identity:** the enterprise web platform manager. plateau-app CLAUDE.md
scopes it over dependency graphs, design systems, intents, CI, compliance,
micro-frontends, feature flags, A/B testing, translations, versioning, deployment
— each a candidate offering. Old `plateau` repo has no monetization material.
See [[reference_repo_constellation]].