---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-11"
tags: [exercise-app, requirements, validation, financial, insurance, healthcare, government, logistics, coverage, showcase]
crossRef: { url: /backlog/100-requirement-as-code/, label: "Requirement-as-code (#100)" }
---

# Flagship exercise apps — full, complex apps that stress the whole standard end-to-end

A program to pick a small slate of **full, complex line-of-business apps** and
build them against the standard — not toy demos, but apps with real, derivable
requirements that exercise our **components, intents, and principles** under load.
Each candidate is chosen to stress a different part of the surface
(validation/rules, collection-ops at scale, drag-and-drop, identity/permissions,
persistence, configurators, view-transitions). One **financial** and one
**insurance** product are mandatory; the rest widen coverage without redundancy.
Perfect fidelity to real law or product rules is **not** required — requirements
only need to be full and complex enough to push the platform.

Each candidate that gets committed graduates to its **own child story** under this
epic, where its requirements are derived (or sourced) and the build is scoped.
This epic is the **slate + selection rationale**; the children are the builds.

## Charter — WE is the deliverable, the app is a forcing function (2026-06-11)

These apps exist to **drive and prioritize Web Everything**, not to be products. Success is measured in
**WE surfaces implemented or codified**, not app features — when app progress and platform progress
conflict, **platform wins.** Each app is built **platform-first**: consume ACTIVE blocks/intents;
when a surface is DRAFT with no runtime, **implement it in WE** (don't hand-roll); when uncodified,
**propose a new standard**. Silent bypass is prohibited — a temporary scaffold must be tagged
`// PLATFORM-GAP: #NNN` against a tracked backlog item. This runs as a **self-refining loop**:
`check:app-conformance` (the strict benchmark, `we:scripts/check-app-conformance.mjs`) emits a ranked WE
work queue → fill the top gap in WE → app consumes it → rescan. Full method:
[we:docs/agent/exercise-app-workflow.md](/docs/agent/exercise-app-workflow.md) (Claude: `/exercise-app`).
Gaps found here *are* the WE roadmap, so this program doubles as a prioritization engine.

## Committed selection (2026-06-11)

Committed: **A (loan origination), B (auto insurance lifecycle), G (telecom CPQ),
E (patient intake & care)** — chosen over the original A+B+C+D+E recommendation to
pull in the configurator-heavy **G** and the privacy-heavy **E**.

Child stories (each = derive requirements + scope build):

- **#317** — A · Loan / mortgage origination.
- **#318** — B · Personal auto insurance lifecycle + claims.
- **#319** — G · Telecom CPQ (configure-price-quote).
- **#345** — E · Patient intake & care coordination.

**Kept as ideas for later** (not committed, remain in the pool below): **C** (government
benefits eligibility), **D** (logistics order & fulfillment), **F** (HR / ATS), **H** (retail
point-of-sale + inventory).

## Why this exists

We have a broad surface — droplist family, pagination, nav blocks, the intent
catalog (collection-ops, clipboard/DnD/files, theme-color, webscroll,
view-transitions, webcommands), the Web Projects (webvalidation, webpermissions,
webpersistence, webidentity, webcomponents), and the cross-cutting principles
(native-first, requirement-as-code [#100], business-rule-manager /
proof-of-compliance [#093], NL-to-technical-configurator [#096], provider-consumer
graph). Isolated block demos don't prove these compose under a real workload. A
handful of complex apps does — and surfaces gaps the demos hide.

## Selection criteria

A good exercise app should hit most of:

- **Complex, multi-step forms** with conditional branches and cross-field rules → webvalidation, requirement-as-code.
- **Codifiable business rules** with a compliance/eligibility story → business-rule-manager, proof-of-compliance.
- **Data at scale**: tables with sort / filter / bulk-action / pagination → collection-ops, pagination.
- **Hierarchy**: trees, categories, org charts → tree-select.
- **Multiple roles** with different views and permissions → webidentity, webpermissions, governance personas.
- **Long-lived work**: save-and-resume, drafts → webpersistence.
- **Rich interaction**: drag-and-drop, clipboard, file upload → clipboard/DnD/files intents.
- **Stepped navigation / flow** with transitions → nav blocks, view-transitions.
- **Configuration with dependencies** → Technical Configurator, NL-to-configurator.

## The slate

### Committed minimum (mandatory)

**A · Financial — Loan / mortgage origination platform.** Borrower wizard (apply,
upload docs, e-sign), eligibility & affordability rules (DTI, LTV, income
verification), an **underwriter workbench** (conditions, decisioning), and product/rate
selection. *Stresses:* validation + requirement-as-code (rule-heavy), business-rule
proof-of-compliance, file-upload intents, multi-role permissions (borrower /
processor / underwriter), persistence (multi-day application), collection-ops
(conditions & document checklists), configurator (product & rate). *Alternates if we
want a different financial flavor:* retail-banking dashboard (accounts, transfers,
payees, transaction history) or brokerage / portfolio management.

**B · Insurance — Personal auto: quote → bind → issue → endorse → renew → claim.**
The full policy lifecycle plus an **FNOL / claims** flow. Rating & underwriting
rules, deeply conditional questionnaires, coverage hierarchy, document handling,
and roles (agent / underwriter / adjuster / policyholder). *Stresses:* everything in
(A) plus heavy conditional-form logic (configurator / NL-to-config), coverage tree
(tree-select), view-transitions across quote steps, and permissions across the
lifecycle. *Scope lever:* hold to one product line (personal auto) to keep
requirements tractable.

### Candidate pool (other lines of business — pick a few to round out coverage)

**C · Government / Civic — Benefits eligibility & enrollment** (means-tested, e.g.
unemployment / assistance). Long means-tested application, **eligibility determination**,
document upload, appeals workflow. *Best showcase for:* requirement-as-code and
business-rule / proof-of-compliance — eligibility logic is the purest expression of
rules-as-code. Also strong on accessibility and persistence.

**D · Logistics / Supply chain — Order & fulfillment management.** Order capture,
inventory, pick/pack, shipment tracking, returns. *Best showcase for:* collection-ops
at scale (large tables, bulk actions, saved views), drag-and-drop (assignment,
reordering), tree (categories / BOM), pagination, clipboard.

**E · Healthcare — Patient intake & care coordination.** Registration, insurance
eligibility, scheduling, clinical intake forms, care plans (task tree), referrals.
*Best showcase for:* strict permissions / privacy (PHI → webpermissions, governance
personas), identity, scheduling UI, and hierarchical clinical coding (tree-select).

**F · HR / Workforce — Applicant tracking & onboarding (ATS).** Job reqs, candidate
pipeline (kanban DnD), interview scheduling, offer, onboarding checklist, org chart.
*Best showcase for:* DnD pipelines / kanban, org tree, role-based views, scheduling.

**G · Telecom / CPQ — Configure-price-quote for a service plan.** Product configurator
with dependency constraints, pricing, order capture. *Best showcase for:* the
Technical Configurator and NL-to-configurator paradigms directly.

**H · Retail — Point-of-sale + inventory management.** Storefront/catalog, cart &
checkout (POS register), inventory & stock levels, purchasing/receiving, returns, and
back-office reporting. *Best showcase for:* collection-ops at scale (catalog, stock tables,
bulk price/stock edits), barcode/scan & clipboard input, persistence (held carts /
offline-ish register state), pagination, and fast keyboard-driven flows. Overlaps **D**
(logistics) on collection-ops but leans transactional/checkout rather than fulfillment.

## Coverage matrix (candidate → surfaces stressed)

| Surface                         | A Loan | B Insurance | C Benefits | D Logistics | E Health | F ATS | G CPQ | H Retail |
|---------------------------------|:------:|:-----------:|:----------:|:-----------:|:--------:|:-----:|:-----:|:--------:|
| Validation / requirement-as-code|  ●●●   |    ●●●      |   ●●●      |     ●       |   ●●     |  ●    |  ●●   |    ●     |
| Business-rule / proof-of-compl. |  ●●●   |    ●●●      |   ●●●      |     ○       |   ●●     |  ○    |  ●●   |    ○     |
| Collection-ops (table at scale) |  ●●    |    ●●       |   ●        |     ●●●     |   ●●     |  ●●   |  ●    |   ●●●    |
| Pagination                      |  ●●    |    ●●       |   ●●       |     ●●●     |   ●●     |  ●●   |  ●    |   ●●●    |
| Tree-select (hierarchy)         |  ●     |    ●●       |   ●        |     ●●      |   ●●●    |  ●●●  |  ●●   |    ●●    |
| Drag-and-drop / files / clipbd. |  ●●    |    ●●       |   ●●       |     ●●●     |   ●      |  ●●●  |  ●    |    ●●    |
| webidentity / webpermissions    |  ●●●   |    ●●●      |   ●●       |     ●●      |   ●●●    |  ●●   |  ●    |    ●●    |
| webpersistence (save & resume)  |  ●●●   |    ●●       |   ●●●      |     ●●      |   ●●     |  ●●   |  ●●   |   ●●●    |
| Nav blocks / view-transitions   |  ●●    |    ●●●      |   ●●       |     ●●      |   ●●     |  ●●   |  ●●   |    ●     |
| Technical Configurator / NL-cfg |  ●●    |    ●●●      |   ●        |     ●       |   ●      |  ●    |  ●●●  |    ○     |

*●●● primary stress · ●● meaningful · ● incidental · ○ minimal*

## Next steps

1. ~~Confirm the slate.~~ Done — A, B, G, E committed (#317–#320).
2. ~~Create a child story per committed candidate.~~ Done (#317–#320).
3. Per child: **derive the requirements** (source strategy noted in each story), then **scope the
   build** into agent-ready slices.
4. Revisit the pool (**C, D, F**) once the first apps surface real coverage gaps.
