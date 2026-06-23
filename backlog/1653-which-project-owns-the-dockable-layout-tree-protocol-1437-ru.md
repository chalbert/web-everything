---
kind: decision
status: resolved
blockedBy: []
relatedProject: webintents
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-dockable-protocol-ownership-placement.md
crossRef: { url: /research/dockable-protocol-ownership-placement/, label: "Prep survey — dockable Protocol ownership / placement" }
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#protocol-host-project"
tags: [dockable, protocol, project-placement, "1437", "1486"]
---

# Which project owns the dockable layout-tree Protocol (#1437 ruled the family project-less)

Blocks [#1486](/backlog/1486-mint-the-dockable-layout-tree-interchange-protocol-core-sche/) (mint the dockable
layout-tree Protocol). #1486's convergence gate is already satisfied — #1627 (the dockview adapter) is
conforming impl family #2 — so the mint is unblocked on convergence but hits an ownership gap #1437 left open.
[#1437](/backlog/1437-decision-docking-tiling-dockable-window-management-placement-/) Fork 1 ratified the
dockable family as "intent + composing block, **no project**" while Fork 2 ratified the serialized layout tree
as a "**first-class WE Protocol**" — and a WE protocol entry *requires* an owning project, so the two rulings
collide at mint time. The prior-art survey
([`/research/dockable-protocol-ownership-placement/`](/research/dockable-protocol-ownership-placement/),
report linked via `relatedReport`) finds the standards world homes interchange formats in **dedicated
host/registry surfaces** (glTF→Khronos 3D Formats WG, OpenAPI→OpenAPI Initiative), never owner-less — and the
docking incumbents share no coordinating body at all, so WE must home the schema itself. **Recommended default:
mint a thin `weblayout` protocol-host project that owns only the schema** — honours #1437 Fork 1 (the *family*
stays project-less; only the *Protocol* gets a home) with no re-open and no model relaxation.

## What you have to decide

Where does the dockable layout-tree Protocol live, given the family has no project — mint a project, attach to
an existing one, or relax the protocol model to allow a project-less protocol?

## Axis-framing

The collision is mechanical, pinned to the real tree:

- A WE protocol entry (we:src/_data/protocols/*.json) **requires** an owner. `validateProtocol`
  (we:scripts/check-standards-rules.mjs:772) lists `ownedByProject` + `anchor` in its required-fields loop;
  lines 777-779 reject an `ownedByProject` that does not resolve in we:src/_data/projects.json; lines 783-789
  require the owner's partial we:src/_includes/project-<id>.njk to carry a `<section id="protocol-<id>">`
  anchor. A sample entry (we:src/_data/protocols/anchor-positioning.json) shows the shape:
  `ownedByProject: "webpositioning"`, `anchor: "protocol-anchor-positioning"`, resolved by the
  `<section id="protocol-anchor-positioning">` in we:src/_includes/project-webpositioning.njk:67. **All 39
  protocols have an owner — no project-less escape hatch exists.**
- #1437 Fork 1 (we:backlog/1437-decision-docking-tiling-dockable-window-management-placement.md:183-186)
  ruled the family **intent + composing block, no project**; the `dockable` intent
  (we:src/_data/intents/dockable.json) carries no `ownedByProject`, like every #1384 sibling. Fork 2
  (we:backlog/1437-decision-docking-tiling-dockable-window-management-placement.md:187-192) ruled the
  serialized tree **is a first-class Protocol**. Those can't both hold as-authored once the entry needs an
  `ownedByProject`.

## Decision — RATIFIED 2026-06-23: (a) mint a thin `weblayout` protocol-host project

**Ruling:** the dockable layout-tree Protocol is owned by a new **`weblayout`** project — a thin
**protocol-host** that owns *only* the schema: the `dockable-layout-tree` Protocol entry, its
`<section id="protocol-dockable-layout-tree">` anchor in `we:src/_includes/project-weblayout.njk`, and its
round-trip conformance vectors. **Nothing behavioural.** The `dockable` intent + its realizing block stay
project-less, exactly as #1437 Fork 1 ruled — so no re-open of #1437, no relaxation of the
`validateProtocol` required-owner invariant (we:scripts/check-standards-rules.mjs:772-789, verified: 39/39
protocols owned, no escape hatch). Honours the standards-world pattern (glTF→Khronos, OpenAPI→OpenAPI
Initiative): interchange formats get a dedicated host surface, never owner-less.

**Skeptic SURVIVED** (recorded below): a schema-only host is a different *category* from the
family-orchestration project Fork 1 declined — Fork 1 explicitly left the serialized tree to Fork 2. (b)
rejected as mis-homing; (c) kept dormant as the escape only if the category split is later rejected.

**Unblocks #1486** (mint the Protocol under `ownedByProject: "weblayout"`); the `weblayout` project +
partial + anchor are part of that mint. Sub-fork 1·sub stays dormant.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — Ownership of the layout-tree Protocol** | **(a)** mint a thin `weblayout` **protocol-host** project that owns only the schema | **(c)** relax the protocol model to allow a project-less protocol | ~70% |
| **1·sub — *(only if (a) is rejected on the reopen objection)* escape-hatch schema** | optional `ownedByProject` iff `ownedByIntent` resolves **+ an intent-anchored catalog rendering path** | leave the protocol with no catalog home | ~60% |

## Fork 1 — Ownership of the dockable layout-tree Protocol: mint a host project, attach to an existing one, or relax the model?

**Why it's a fork:** three coherent branches that **cannot coexist** — the Protocol's `ownedByProject` field
points at exactly one home (or the field is made optional). One home must be chosen; the standard ships one
shape. A genuine either/or, not mechanical authoring.

**Crux + refs:** the layout-tree genuinely *is* a Protocol (independent vendors interoperate — dockview ⇄
FlexLayout ⇄ golden-layout serialize the same `row→column→stack-of-tabs` tree; #1437 Fork 2 already ruled this,
and #1627 proved the round-trip as impl family #2). So the open question is purely **ownership**, against the
`validateProtocol` required-owner invariant (we:scripts/check-standards-rules.mjs:772-789) and #1437 Fork 1's
"no project" ruling (we:backlog/1437-decision-docking-tiling-dockable-window-management-placement.md:183-186).
The prior art (we:reports/2026-06-22-dockable-protocol-ownership-placement.md) is decisive: serious interchange
formats are homed in a **dedicated host/registry surface** (glTF→Khronos 3D Formats WG; OpenAPI→OpenAPI
Initiative), never owner-less, and the docking incumbents have *no* coordinating body, so there is no external
owner to point at — WE must home the schema.

- **(a) Mint a thin `weblayout` protocol-host project that owns only the schema** *(recommended)*. A
  registry/host surface (the glTF/OpenAPI shape) that owns the Protocol entry, its
  `<section id="protocol-dockable-layout-tree">` anchor in we:src/_includes/project-weblayout.njk, and its
  round-trip conformance vectors — **nothing behavioural**. *Merit — catalog-surface integrity:* the Protocol
  renders like the other 39, no data-model special-case. *Merit — honours #1437 Fork 1:* Fork 1 rejected an
  *impl/orchestration* project for the **family**; a host that owns *only the schema* is a different category —
  the intent + block stay project-less, only the *Protocol* gets a home. *Merit — minimize-lock-in:* the
  schema is escapable and discoverable, conformance has a named home.
- **(b) Attach the Protocol to an existing adjacent project** *(Rejected — mis-homing)*. No project ever owned
  this concern: `webpositioning` is floating-element anchoring (we:src/_data/projects/webpositioning.json — a
  different concern); `webblocks`/`webintents` never named layout interchange, and a Protocol is a different
  *entity class* from an intent, so homing the schema under `webintents` conflates the two layers #1437
  separated. *Merit cost (correctness, not effort):* picking a never-owner mis-files the schema and blurs that
  project's meaning — a catalog-integrity regression.
- **(c) Relax the protocol model to allow a project-less protocol** *(Rejected for the default — kept as the
  sub-fork escape-hatch)*. Amend `validateProtocol` so `ownedByProject` is optional when an `ownedByIntent`
  resolves, skipping the anchor probe. *Merit FOR:* honours "no project" literally with zero new surface.
  *Merit AGAINST — catalog-surface integrity:* makes the dockable tree the **one protocol with no catalog
  home** (the project partial's `<section id="protocol-...">` anchor *is* the rendered protocol's home); the
  prior art is uniformly against owner-less interchange formats. *Merit AGAINST — invariant erosion:* relaxes
  a rule all 39 protocols satisfy, to serve one — a structural regression on the surface *minimize-lock-in*
  most needs crisp (the protocol IS the escapable lock).

**Recommended: (a), ~70%.** *(Residual: whether a schema-only host project is read as honouring or violating
#1437 Fork 1's no-project ruling — the load-bearing claim is that a host owning only the schema is a different
category from the family-orchestration project Fork 1 rejected. If that reading is rejected, fall to the
sub-fork.)*

**Skeptic: SURVIVES** *(attack: does a `weblayout` host project secretly re-introduce the very project #1437
Fork 1 rejected — i.e. is (a) just a disguised reopen?).* The attack has force only if `weblayout` accretes
impl or orchestration (behaviour, a "docking domain"). It does not, *by construction*: the host owns the
**Protocol entry + anchor + conformance vectors and nothing else**; the `dockable` intent
(we:src/_data/intents/dockable.json) and its realizing block stay project-less, exactly as Fork 1 ruled. Fork 1
rejected a project for the **family**; (a) homes only the **interchange schema** — a category Fork 1 never
ruled on (it explicitly left the *serialized tree* to Fork 2). So (a) honours both rulings rather than
reversing either. **SURVIVES — no reopen of #1437 Fork 1 required.** *(The residual is recorded above: if the
deciding agent disagrees with this category split, the sub-fork is the escape.)*

### Fork 1·sub — *(engaged only if (a) is rejected on the reopen objection)* the escape-hatch schema

If the decision goes to **(c)**, a second sub-decision opens: *how* to relax the model without orphaning the
protocol from the catalog. **Recommended: make `ownedByProject` optional iff `ownedByIntent` resolves in
we:src/_data/intents/, AND add an intent-anchored rendering path** so a project-less protocol still renders
under its owning intent's page (preserving discoverability/conformance the project anchor currently provides).
*~60%. Rejected alternative: simply drop the owner requirement with no replacement home — leaves the protocol
catalog-less, the exact catalog-integrity hole (b)/(c)'s merit-against names.* This sub-fork is dormant unless
(a) loses.

---

## Context

**Classification (per-fork pass, recorded).** The layout-tree genuinely *is* a Protocol (independent vendors
interoperate — dockview/FlexLayout/golden-layout serialize the same tree; #1627 round-trips it), not
intent-internal state — so #1437 Fork 2 holds. The remaining call is **ownership**, a single fork with three
mutually-exclusive homes (mint / attach / relax). Bias notes applied: *constellation/most-permissive default*
and *minimize-lock-in* (the protocol is the single escapable lock — its catalog surface must stay crisp); the
*bias-toward-separation* favours a dedicated host over dumping the schema into an unrelated project. Cost/effort
("broader schema change", "more to maintain") was **stripped** as a merit axis — every downside above is
re-expressed as lock-in / correctness / catalog-surface integrity / fidelity-to-#1437.

**Lineage.**
- #1437 Fork 1 (intent + block, **no project**,
  we:backlog/1437-decision-docking-tiling-dockable-window-management-placement.md:183-186) vs Fork 2 (layout
  tree **is a Protocol**, :187-192) — the gap.
- The protocol-bar convergence gate is satisfied (#1627 = conforming impl family #2; #1486 no longer waits on
  convergence — only on this ownership call). Convergence survey:
  we:reports/2026-06-21-docking-tiling-partition-tree.md; ownership survey:
  we:reports/2026-06-22-dockable-protocol-ownership-placement.md.

## Definition of Ready — met

- ✅ A `/research/` prep survey of how project-less / cross-cutting interchange formats are owned
  ([`/research/dockable-protocol-ownership-placement/`](/research/dockable-protocol-ownership-placement/),
  report linked via `relatedReport`).
- ✅ The single ownership fork stated with options (a)/(b)/(c) + a **bold** recommended default + confidence
  (glance table + per-fork), plus the conditional sub-fork.
- ✅ Skeptic pass recorded (SURVIVES — no reopen of #1437 Fork 1 required).
- ☑ `preparedDate` set; ratifiable now via `/next decision`.
