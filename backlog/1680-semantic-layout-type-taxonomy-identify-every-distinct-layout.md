---
kind: decision
status: open
relatedProject: webintents
relatedReport: reports/2026-06-23-semantic-layout-role-taxonomy.md
crossRef: { url: /research/semantic-layout-role-taxonomy/, label: "Prep survey — semantic layout-role taxonomy (a11y + design POV)" }
preparedDate: "2026-06-23"
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
tags: [layout, taxonomy, intent, a11y, composition-intent, "1653"]
---

# Semantic layout-type taxonomy — identify every distinct layout role (a11y + design POV); 1 FUI impl per role, style variants via plateau

Establish the canonical taxonomy of semantically-distinct **layout roles** WE must cover, surveyed from
both an **accessibility POV** (landmark/region semantics, reading & focus order, responsive reflow) and a
**design POV** (the recurring composition patterns). The goal: name each distinct role once, so FUI provides
exactly **one implementation per role** and per-project visual differences ride **presentational variants +
plateau assembler presets** over that single role — never new components. This decision rules the **role
taxonomy**, not the variant model (that half is already codified). Once ratified it seeds per-role mint
items (intent/block per role) under FUI.

## What you have to decide

1. **By what criterion is one layout role distinct from another** (Fork 1 — the load-bearing call), and
2. **at what altitude the taxonomy stops** — are page archetypes (app-shell, list-detail) roles, or
   compositions of roles? (Fork 2),
3. then **ratify the core role set** the criterion produces (the table below; an open-numbered set with a
   minting contract, not a closed vote).

## Why this isn't already covered

Today WE ships only a concept-stage `layout` intent (we:src/_data/intents/layout.json — app-shell region
mechanics: `shell`/`pane`/`dock` × `push`/`overlay`/`rail`) plus scattered point intents (`resizable` #1384,
`arrangeable`, `overview-grid`, `slide-layout-template` #1191). There is **no systematic map of the role
set** and **no stated criterion** for what makes a role distinct — so new layout work is ad-hoc.

The prior-art survey (we:reports/2026-06-23-semantic-layout-role-taxonomy.md; research topic
[`/research/semantic-layout-role-taxonomy/`](/research/semantic-layout-role-taxonomy/)) surveyed Every
Layout, WAI-ARIA landmarks, Tailwind, MUI, Radix, Chakra, Carbon, Material Design 3, Open UI, and CSS-native
patterns. **Decisive finding:** the sources draw "distinct role" by *different, orthogonal* criteria — Every
Layout by **CSS mechanism** (Stack≠Cluster≠Grid), ARIA by **document semantics** (banner/nav/main/…), MUI/M3
by **composition intent**. The *sidebar case* proves orthogonality: Every Layout has one `Sidebar` primitive,
but ARIA classifies the same box as `navigation` *or* `complementary` purely by content. So CSS-mechanism and
landmark-meaning are independent axes, not refinements — which is exactly what Fork 1 must resolve.

## Settled by default — not forks (forced by codified rules)

These follow directly from existing statute; recorded so the decision turn doesn't re-open them:

- **Roles are project-less *intents*; FUI ships exactly one block impl per role.** Layout roles are semantic
  UX contracts → intents (we:feedback intent-ux-only; like the existing `layout`/`resizable`/`arrangeable`
  intents, which carry no `ownedByProject`). No new project is needed for the taxonomy.
- **The role set is open-numbered with a ratified core + a minting contract**, not a closed list — mirrors
  Intents-Open-Design + we:docs/agent/platform-decisions.md#open-numbered-variants applied to roles. A
  candidate earns a role iff it adds a **distinct composition-intent** (per Fork 1); else it is a *variant*
  (differs only in look) or an *annotation* (differs only in content meaning), never a new role.
- **Per-project styling rides the variant axis + plateau assembler presets** (open-numbered-variants +
  assembler open-core #775) — the user's "1 impl, many styles via plateau" is the *consequence* of the
  above, already codified, **out of scope** for this decision.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — Distinctness criterion** | **(a)** identity = **composition-intent** (impl-agnostic); CSS-mechanism = FUI impl detail, ARIA landmark = optional author annotation | **(b)** hybrid keyed on **CSS-mechanism** × optional landmark | ~75% *(flipped from (b) by the skeptic)* |
| **2 — Taxonomy altitude** | **(b)** primitives are roles; page archetypes are a **separate composition-intent tier** (the live `layout` intent is its charter member — not retracted), impl'd as FUI blocks + presets | **(a)** admit page archetypes as first-class roles | ~70% |

## Fork 1 — By what criterion is a layout role *distinct*?

**Why it's a fork:** three coherent identity criteria that **cannot co-hold** — a role's identity keys on
*exactly one* primary axis, and the survey shows the axes are orthogonal (the sidebar case), so picking one
excludes the others as the primary key. A genuine either/or, not mechanical authoring.

- **(a) Identity = composition-intent** *(recommended)*. A role is the **semantic arrangement the author
  wants** — "even vertical flow with consistent spacing" (stack), "a wrap-group of peers" (cluster), "a
  fixed+fluid split that collapses when narrow" (sidebar) — *independent of how it's implemented*. The CSS
  mechanism (margin-flow vs `gap` vs auto-fit grid) is **FUI's impl detail** of that one intent; the ARIA
  landmark (`navigation`/`complementary`/…) is an **optional author annotation** bound to the content, not
  the role. *Merit — contract-not-computation* (we:docs/agent/platform-decisions.md#surface-contract-not-computation,
  Impl-Is-Not-A-Standard #020): the role's identity stays durable when CSS evolves (when `grid masonry`
  ships, "masonry" doesn't merge into "grid" — they remain distinct *intents*). *Merit — it's the WE entity
  for semantic UX* (intents are exactly impl-agnostic UX contracts). *Merit — resolves the orthogonality*:
  the two rejected axes become a sub-layer (impl) and an annotation, not competing identities.
- **(b) Identity = CSS-mechanism × optional landmark (hybrid)** *(rejected — was the prep default; flipped)*.
  The Every-Layout cut: one role per distinct CSS idea, cross-cut by an optional landmark. *Merit FOR:*
  crisp, demonstrable primitives. *Merit AGAINST (the skeptic, decisive):* it keys role **identity on the
  computation** — the exact thing surface-contract-not-computation forbids. It fragments arbitrarily
  (Stack-via-margin vs Stack-via-`gap`?) and **mutates the taxonomy when a browser ships a feature** (CSS
  masonry would collapse "masonry" into "grid"); a *semantic* identity must not move on a CSS release. The
  "optional landmark" is the tell — it concedes mechanism can't carry semantics, then defers semantics to an
  optional field, so the taxonomy carries no required meaning. Kept as the impl sub-layer under (a).
- **(c) Identity = document-semantics / ARIA-landmark only** *(rejected — under-determining)*. Key roles by
  landmark meaning. *Merit AGAINST:* most layout primitives map to **no** landmark — stack, cluster, grid,
  center all share "none", so a pure-landmark criterion cannot tell them apart at all. Landmark is real but
  belongs as the **annotation axis** under (a), not the identity.

**Recommended: (a), ~75%.** *(Residual: whether "composition-intent" is crisp enough to be a minting
contract or risks the "vague intent" critique — mitigated by the role-vs-variant-vs-annotation test below,
which gives an operational cut. If it proves too soft in authoring, the fallback is (a) with a *named
mechanism family* as a documented secondary discriminator — not a return to (b)'s identity claim.)*

**Skeptic: REFUTED the prep default (b) → flipped to (a).** *(Attack: keying identity on CSS-mechanism
violates contract-not-computation and makes roles brittle to CSS evolution — masonry merges into grid when
CSS masonry ships; the "optional landmark" admits mechanism can't carry the semantics.)* The attack holds on
merit and aligns with codified statute (#020, surface-contract-not-computation), so the default is flipped:
composition-intent is the identity, CSS-mechanism demoted to FUI impl, landmark to author annotation.

### The role-vs-variant-vs-annotation cut line (the minting contract)

Operationalizes (a): a candidate is **a new role** iff it is a *distinct composition-intent* (a different
semantic arrangement). It is **a variant** (not a role) if it differs only in presentation (MUI ImageList
standard/quilted/woven = one Grid role + variants; Chakra HStack/VStack = an axis *variant* of Stack). It is
**an annotation** (not a role) if it differs only in content meaning (a `navigation` sidebar vs a
`complementary` sidebar = one Sidebar role + a landmark annotation).

## Fork 2 — At what altitude does the taxonomy stop?

**Why it's a fork:** two coherent answers that **cannot both define** whether "app-shell" is a role —
either page archetypes are entries in the role set, or they are compositions *of* roles seated in a separate
tier. One shape ships. A genuine either/or.

- **(b) Primitives are roles; page archetypes are a separate composition-intent tier** *(recommended)*.
  App-shell, list-detail, feed, holy-grail are arrangements *of* region roles, not atomic roles — so they
  are **not** in the per-role component taxonomy (where FUI = one component per role). They live in a
  distinct **composition-intent tier**, impl'd as FUI *blocks* composing region components + assembler
  presets. *Merit — bias-to-separation:* a region role (sidebar) ≠ a page archetype (app-shell). *Amendment
  (skeptic):* the existing `layout` intent (we:src/_data/intents/layout.json) **is** exactly an app-shell and
  is the **charter member** of this composition-intent tier — it is **not retracted or orphaned**; it is
  reclassified as a composition-intent, distinct from the primitive roles.
- **(a) Admit page archetypes as first-class roles** *(rejected)*. Treat app-shell/list-detail/feed as roles
  alongside stack/grid (the MD3 "canonical layouts" framing). *Merit AGAINST:* conflates two altitudes — an
  archetype is definitionally a *composition* of region roles, so admitting it makes the primitive/composition
  line incoherent and the "one component per role" rule ill-defined (an app-shell component would re-implement
  region roles it should *compose*).

**Recommended: (b), ~70%.** *(Residual: where exactly the primitive/composition line sits for borderline
cases — a "sidebar" is itself a 2-region split, so the line is "atomic composition-intent vs page-spanning
arrangement"; refine in the role-set authoring.)*

**Skeptic: SURVIVES-WITH-AMENDMENT.** *(Attack: excluding app-shell contradicts shipped reality — `layout`
intent already ships an app-shell as a first-class intent.)* The fix is not to admit archetypes as *roles*
but to recognise the **composition-intent tier** and seat the live `layout` intent there as its charter
member — honouring bias-to-separation without retracting shipped reality or contradicting MD3's first-class
treatment of canonical layouts. Amendment folded into (b) above.

## Recommended core role set (open-numbered; ratify the core, mint the rest by the Fork-1 contract)

Composition-intent identities (Fork 1a). CSS mechanism shown as *impl guidance for FUI*, not identity.

| Role (intent) | Composition-intent (the semantic arrangement) | Universal? | FUI impl mechanism (not identity) | Landmark annotation (optional) |
|---|---|---|---|---|
| **stack** | even-spaced vertical flow of siblings | ✅ core | margin-flow / flex-col + gap | — |
| **cluster** | wrap-group of peers (tags, action rows) | ✅ core | flex-wrap + gap | — |
| **grid** | uniform responsive cells, fit-to-container | ✅ core | auto-fit `minmax` | — |
| **box / container** | padded, max-measure container | ✅ core | padding / max-width + auto-margin | `region` if named |
| **center** | center a child + constrain measure | core | margin-auto / flex-center | — |
| **sidebar / split** | fixed + fluid columns, collapses when narrow | core | flex-basis + grow + wrap | `navigation`\|`complementary` |
| **frame** | crop media to a fixed aspect ratio | core | `aspect-ratio` + `object-fit` | — |
| **reel** | horizontally scrolling overflow strip | candidate | overflow + scroll-snap | `region` |
| **imposter / overlay** | center a child over a positioning context | candidate | absolute / grid-stack | (dialog → role) |
| **cover** | full-height focal child between optional header/footer | candidate | flex-col + margin-auto | — |
| **switcher** | flip H↔V at a content threshold (no breakpoint) | candidate | flex-wrap + `min()` | — |
| **masonry** | shortest-column packing | candidate | grid masonry / columns | — |

Existing point intents fold in: `resizable` (#1384) is the behavior under **sidebar/split**'s draggable
boundary; `slide-layout-template` (#1191) and `overview-grid` are **app-shell-tier compositions** /
domain-specific. **app-shell** (the live `layout` intent) is the composition-intent tier (Fork 2b), not a
row here.

## Lineage

Surfaced 2026-06-23 alongside #1653 (the dockable layout-tree Protocol → `weblayout` host). Related point
intents already shipped: `resizable` (#1384), `arrangeable`, `slide-layout-template` (#1191), `overview-grid`.
Prior art: we:reports/2026-06-23-semantic-layout-role-taxonomy.md. On ratification, seeds per-role mint items
(intent + FUI block per core role) and a composition-intent-tier reclassification of `layout`.

## Definition of Ready — met

- ✅ `/research/` prep survey published (Every Layout, WAI-ARIA, Tailwind, MUI, Radix, Chakra, Carbon, MD3,
  Open UI, CSS-native) — `relatedReport` + research topic linked.
- ✅ Two forks stated with options + bold defaults + confidence (glance table + per-fork); settled-by-default
  items separated from forks.
- ✅ Skeptic pass run in prep: Fork 1 **REFUTED → flipped** to composition-intent; Fork 2
  **SURVIVES-WITH-AMENDMENT** (composition-intent tier; `layout` not retracted).
- ✅ Recommended core role set + role-vs-variant-vs-annotation minting contract authored.
- ☑ `preparedDate` to set at stamp; ratifiable via `/next decision`.
