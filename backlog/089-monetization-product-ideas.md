---
kind: epic
status: open
dateOpened: "2026-06-06"
tags: [monetization, business-model, open-source, conformance, certification, adapters, module-as-a-service, webdocs, registries, migration]
relatedProject: webcases
crossRef: { url: /protocols/, label: Conformance protocols }
---

# Monetize the standard without compromising open-source / non-vendor-lock

Product ideas for earning revenue from the Web Everything ecosystem **without
charging for the standard itself or locking implementations in**. The whole
premise — protocols make implementations *swappable* and *combinable* — means
you cannot lock anyone in at the component level. So the money sits *beside* the
open spec, in three layers: **trust** (continuous verification), **hosted
infrastructure** (CDN, registry, docs), and **interop tooling** (migration).

**Guiding principle: open source = free, paid product = license.** The standard,
the conformance suite, the adapter transform core, and the docs generator are all
open source and free — including running the compliance check yourself. The
compliance/verification *tool is never gated*; doing so would contradict the
premise. The paid products are **licensed** managed/hosted/enterprise offerings
(commercial license of the hosted service, not of the standard) — so "cancel and
run it yourself" is always true. Open-core + open-standard-plus-hosting
(Redis/Supabase) + trusted-attestation (the SSL/CA model) applied to this repo.

**Out of scope by request:** consultancy, and "build an app" / productizing
plateau-app itself. These are ideas that derive from the *open-standard nature*.

## Solo-founder delivery lens (the hard prioritiser)

This is run by **one person** who wants to stay solo as long as possible, so the
*overriding* filter is **low manual work and no personal bottleneck** — and in
particular **minimal uptime/support obligation**. Be wary of anything needing
personal support, and **defer any live-serve solution that could break and demand
instant support**. Rank delivery shapes by operational burden:

1. **Self-run tool on the customer's own dev computer / CI** — *preferred*. No
   uptime on us, nothing to break on our side, no support SLA. Sell it as a
   licensed binary/package the customer runs.
2. **A single self-hosted service we run** — *second*. One service, one thing that
   can break; acceptable but it introduces uptime/support risk.
3. **Custom, configured, self-hosted at the enterprise** — *last*. Heavy
   per-customer contract negotiation, configuration, and support — the biggest
   bottleneck for a solo operator.

**Tool-form before service-form.** Most ideas below have *both* a tool form (runs
on the customer's machine/CI — tier 1) and a service form (we host it — tier 2+).
**Ship the tool form first**; treat the hosted/live-serve version as a later phase
once there's a reason to take on uptime — **parked, not forbidden**: its concrete home
is [#554](/backlog/554-plateau-hosted-saas-product-suite-shell-multi-product-accoun/)
(the hosted SaaS-suite shell), under which per-product hosted economics park. This pairs
with "open source = free, paid product = license": a licensed self-run tool is the
lowest-burden way to charge.

## The ideas (ranked by fit)

### 1. Trusted continuous conformance verification — *strongest fit*
**Not** a manual certification step, and **not** a fee for the right to a badge —
that would mean gating the compliance tool, which contradicts the premise. The
`webcases` suite stays **open and free**: anyone runs it, gets a result, and
**self-attests** a badge at no cost. What's salable is *continuous trusted
verification* — a hosted service that re-runs the open suite on every release and
issues a **live, tamper-evident attestation** ("verified conformant as of commit
`abc123`, auto-revoked on regression"). A self-claimed badge is a static
assertion that rots on the next bad ship; the paid live badge is always current.
This is the **SSL/CA model**: verifying a cert is open and free; you pay a CA for
trusted *issuance + revocation infrastructure*, not for the right to be secure.
The hosted CI below **is** this product — the live badge is just its output.
- **Revenue:** per-repo license for continuous verification + live attestation;
  dashboards, version-matrix, drift alerts; a verified-listing directory.
- **No lock-in / open premise intact:** the tool is never withheld. Self-test and
  self-attest are free; you sell trusted *re-verification over time*, which only
  has value *because* the underlying check is open and reproducible.

**Lib vs. app — the app is where the revenue is.** Two distinct customers:

- **Library vendor (funnel — free/cheap):** "does your lib correctly implement
  the Validation/Positioning/etc. protocol?" A trust/marketing signal. Thin
  market, few buyers, low ARPU. Keep it ~free so libs adopt the standard —
  conformant libs are what make the *app* guarantee below worth paying for.
- **Enterprise app (the revenue):** an app is **many vendors' providers wired
  together** (validation from A, positioning from B, intl from C) + their own
  components + multiple teams. The protocols *promise* swappable/combinable (L2),
  but only while everyone stays conformant. Nobody can verify *their specific
  composition* except a service watching their actual build. That is the product:
  - **Interop/combination regression** — on every dependency bump, re-verify that
    *their mix* still satisfies the combined contracts. Unique: it's their wiring,
    not a generic lib test.
  - **Why only this can do it:** everything resolves through the
    registries/injectors, which are **introspectable** — the harness enumerates
    what's registered per protocol in the live app and runs the open contract
    tests against the *real assembly*, not a synthetic fixture.
  - **Cross-team contract drift** — team A's change silently breaking team B (via
    webevents/webcontexts) is caught at the app boundary, pre-merge.
  - **a11y / UX-intent conformance of the shipping app** — intents (density,
    motion, a11y) + validation encode accessibility; "continuously prove the
    running app honors WCAG / EN 301 549" is a **regulatory budget line**
    enterprises already pay Deque/axe for. Recurring, sticky, legally motivated.
  - **Revenue:** per-pipeline gated CI check (PR blocker = sticky), per-seat
    dashboards, enterprise license + self-hosted runner, the a11y/regulatory
    compliance report. Far bigger than badging libs.

The clean story: open suite + free lib self-attestation builds the conformant
ecosystem; **the enterprise pays to continuously prove their *assembled app*
still holds together as it and its deps change.**

### 2. Module-as-a-Service: the adapter-transform ESM CDN — *already half-built (#081)*
The serve-time core already returns one authored component as WC / JSX /
functional / transpiled-to-target, per request, as spec-clean ESM. That *is* a
paid CDN product (esm.sh / Skypack, but with `form` + `strategy` params). See
also distribution/caching (#087) and versioning (#088).
- **Revenue:** usage-based edge delivery, build-free hosting, served-form
  analytics, private component endpoints.
- **No lock-in:** output is spec-clean ESM you can self-host; transform core is
  open. The pitch is "don't run the infra," not "you can't leave."

### 3. Framework migration & interop tooling — *highest willingness-to-pay*
The adapters normalize React ⇄ Web Components ⇄ functional ⇄ template-string —
the engine for the thing companies pay dearly for: **migrating a component
library off/onto a framework**. Package as automated codemods + a migration-gap
report.
- **Revenue:** per-migration tooling license, or a hosted "point it at your repo,
  get a conversion + risk report" product.
- **No lock-in:** it moves you *between* frameworks — the literal opposite of
  lock-in, which becomes the marketing.
- **Product vs. service:** this is the *tooling* (the mechanical conversion).
  Performing migrations for a client is consultancy — see
  [#090](/backlog/090-consultancy-revenue-streams/).

### 4. "Web Docs as a Service" — spec-driven docs+conformance site for *their* design system
`webdocs` already generates a docs site from manifests + cases ("the website IS
the spec"). Offer it as hosted, private, conformance-aware docs for a customer's
own component library — a living spec + interop dashboard, not just static
stories.
- **Revenue:** per-org hosting tier (Chromatic / Storybook-Cloud analog, but the
  docs *prove conformance*).
- **No lock-in:** generated from open standards; they keep the generator and the
  output.
- **Promoted to its own item:** fleshed out as a Plateau offering in
  [#091](/backlog/091-web-docs-as-a-service-plateau/).

### 5. Provider↔consumer relationship graph & governance — *the Plateau platform-manager core*
**Not a package registry — npm + git stay the source of packages.** The value is
a control plane over the **provider↔consumer relationships** across an org's web
platform: which providers implement which protocols, who consumes which
providers/contexts/events, and the contract at every seam. Impact analysis ("change
provider X → who breaks?"), cross-team drift detection, ownership/version policy,
and a live platform map — powered by the **introspectable** registries/injectors.
This is what makes Plateau an *enterprise web platform manager*. Promoted to its
own item: [#092](/backlog/092-provider-consumer-graph-platform-manager/).
- **Revenue:** enterprise platform-manager license; bundled with verification
  (idea 1) — the graph is the substrate that makes app-level verification possible.
- **No lock-in:** npm + git remain the package source; Plateau tracks
  *relationships*, not bytes. Registries/injectors/introspection are open and
  self-hostable; the licensed product is the cross-repo aggregation + governance.

## Unifying umbrella — Plateau as the enterprise web platform manager

The home for ideas 2 / 4 / 5 (and more below) is **Plateau as the enterprise web
platform manager it is meant to become** — pay to run the serve-time providers and
the management/governance plane over them, not to access the open standard. The
relationship graph (#092) is the control-plane core; verification (idea 1), MaaS
(#081), Web Docs (#091), and the business-rule/compliance manager (#093) are
offerings on it. Each product stands alone, but they share one platform, one
introspection substrate, and one billing/hosting surface.

**Further Plateau offerings (own items):**
- [#092](/backlog/092-provider-consumer-graph-platform-manager/) — provider↔consumer relationship graph & governance.
- [#093](/backlog/093-business-rule-manager-proof-of-compliance/) — business-rule manager with proof of compliance.
- *(More surfaced from the Plateau / plateau-app repos — e.g. a translation manager — being catalogued.)*

## Recommended order — re-ranked by the solo-founder lens

Operational burden now outranks willingness-to-pay. Lead with the **self-run
tool** forms (tier 1), defer the live-serve ones.

**Tier 1 — self-run tool on the customer's dev/CI (do first):**

*AI-assisted code tools (a family — all self-run, bring-your-own-AI, no uptime on
us). The AI is a **swappable provider** the customer supplies a key for, so we
carry zero model-hosting cost or support — the ideal solo-founder shape:*
- **Mockup → standard-compliant code (#086)** — ingest a mockup, emit WE-compliant
  components/intents/adapter form. A *front door onto the standard*; AI behind a
  registry. Strong tier-1 product.
- **Upgrader tools ([#094](/backlog/094-ai-upgrader-tools/))** — take *existing*
  code and upgrade it: legacy/framework → standard-compliant, or across standard/
  dependency versions. The sibling of "migrate between frameworks" is "upgrade in
  place."
- **Conformance auto-fix agent ([#095](/backlog/095-conformance-auto-fix-agent/))**
  — reads a failing conformance check and loops fix→re-verify until green.
- **NL → Technical Configurator ([#096](/backlog/096-nl-to-technical-configurator/))**
  — describe behavior, AI selects+wires the right strategy from the registries
  (AI front-end to plateau-app's configurator).
- **Migration tooling (idea 3)** — pure self-run codemod + risk report; no uptime,
  high willingness-to-pay, cleanest "we prevent lock-in" story. **Best first bet.**

*Other tier-1 tools:*
- **Verification as a CI/dev tool (idea 1, tool form)** — run the open suite +
  emit a self-attestation/report locally. Low build cost (suite exists). Hold the
  *hosted live-attestation/auto-revoke* service for later (that's live-serve).
- **Docs generator (idea 4, tool form)** — generate the conformance docs site as a
  static artifact on their CI; hosting (#091) is the later service phase.
- **Relationship-graph scanner (idea 5, tool form)** — a CLI that scans repos and
  emits the graph + impact report as a CI artifact; the live cross-repo dashboard
  (#092) is the later service.

**Tier 2 — single self-hosted service we run (only when justified):**
- **Module-as-a-Service (idea 2 / #081)** — inherently a **live CDN**: if it's
  down, consumers' apps break and demand instant support. Despite the working
  skeleton, **defer** it on operational grounds until there's reason to take on
  uptime. Its build-time transform core, however, is a tier-1 tool.
- Hosted forms of verification / docs / graph above.

**Tier 3 — custom, configured, self-hosted at the enterprise (latest):**
- **Business-rule manager + proof of compliance (#093)** and deep platform-manager
  governance — heavy contract negotiation + per-customer config + support. Biggest
  prize, highest bottleneck; sequence last.
- **Consultancy (#090)** — maximum personal bottleneck; optional/opportunistic, not
  a primary stream while solo.

## Candidate products surfaced from the Plateau repos (to catalogue)

plateau-app's `we:CLAUDE.md` scopes Plateau over: relationships/dependency graphs,
code standards, design systems, intents, CI, compliance, micro-frontends, **feature
flags, A/B testing, translations, versioning, deployment**. Each is a candidate
offering. Named so far:
- **Translation manager** — localization management (catalogs, locale negotiation,
  lazy loading) on the **webintl** Localization protocol; a spec-aligned
  Lokalise/Phrase. *Parked — low moat:* Lokalise/Phrase already do AI translation
  well, and our only edge is MF2 + protocol-aligned catalogs. Revisit only if it
  rides the platform-manager as a feature, not as a standalone product.
- Feature-flags, A/B testing, versioning, deployment, micro-frontend management —
  each a possible domain; not yet assessed.
- **Configurators** (plateau-app): Technical Configurator (change-tracking,
  file-upload, sorting; extensible to state/validation/reliability) and Intent
  Configurator ("future Plateau platform offering") — candidate decision-support
  products in their own right.

## AI white-space — the "propose-and-verify" moat

The durable edge for every AI tool here: **incumbents' AI produces *plausible*
output; ours can produce *provably-conformant* output** — because the standard is
a machine-checkable target, a neutral vocabulary (intents/roles/states), and an
introspectable registry. Generic AI tools (Copilot, Cursor, v0, Builder.io) have
no ground truth to verify against. The loop **"AI proposes, the standard verifies"**
is the moat — and it *grows* as models commoditise: everyone will have good models;
only we have the verifiable target that turns a model into a reliable producer.

White-space tools, each uncovered *because* they need the formal standard:
- **Mockup → standard code (#086)** — vs. v0/Builder.io/Locofy (they emit plausible
  framework code; we emit verified-conformant).
- **Upgraders (#094)** — vs. Renovate/Dependabot (they bump versions; we apply
  semantic breaking-change codemods against protocol contracts).
- **Conformance auto-fix agent (#095)** — vs. Copilot/Cursor (generic lint; we fix
  against *your* protocol contracts, gated by the suite).
- **NL → Technical Configurator (#096)** — vs. generic codegen (no registry of
  swappable strategies to target; we navigate a formal decision space).
- **Conformance-case generator** → **[#868](/backlog/868-conformance-case-generator-ai-proposes-standard-verifies/)** — generate `webcases`
  (source of truth) from a description; output feeds docs + tests + badge at once.
- **Platform impact narrator** → **[#869](/backlog/869-platform-impact-narrator-over-the-092-relationship-graph/)** — NL Q&A over the
  relationship graph; vs. dependency tools that lack the provider↔consumer
  *protocol* graph.

**Lower white-space (incumbents strong — caution):** translation/localization AI
(Lokalise/Phrase) and plain version-bump (Renovate). See the parked note above.

## Next step (open)

- **Roadmap to MVP → [#097](/backlog/097-roadmap-to-mvp/)** (product choice, CI,
  auth/licensing, payments, distribution, marketing, legal/brand/insurance).
- Optional later items: **conformance-case generator** (#868) and **platform impact
  narrator** (#869) — now filed.
- For the chosen MVP tool, a short productization note as it starts.
