---
kind: decision
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "intent:breakpoint"
codifiedIn: "docs/agent/platform-decisions.md#project-protocol-bar"
preparedDate: "2026-06-13"
tags: [decision, responsive, container-queries, breakpoint-intent, layout-intent, layer-placement, book-candidate]
relatedReport: reports/2026-06-13-responsive-container-query-layout.md
crossRef: { url: /research/responsive-container-query-layout/, label: "Prep survey — responsive / container-query layout" }
---

# Decision — Responsive / container-query layout: placement

> **Ruling (2026-06-13) — all three forks ratified at their defaults.**
> - **Fork 1 → A:** extend the existing `breakpoint` + `layout` intents; no new project, no new intent.
> - **Fork 2 → A:** one `breakpoint` intent + a `scope: viewport | container` dimension (the genuine call — shared `steps`/`change` model + CSS treating `@container` as a syntactic sibling of `@media` outweigh the substrate difference, which is an impl detail, not a second user-facing concern).
> - **Fork 3 → A:** a deferred `webblocks` FlexRow block (ResizeObserver = impl substrate), carved to [#508](/backlog/508-flexrow-intrinsic-auto-flow-block-webblocks-realizes-breakpo/). Not built now.
>
> Applied: `breakpoint` gained `scope: { values: [viewport, container] }` + a Reference Scope doc section in [we:src/_data/intents.json](../src/_data/intents.json); `layout` left as-is. Graduated to the `breakpoint` intent.

**Prepared 2026-06-13 — ready to ratify.** Grounding: a prior-art survey
([`/research/responsive-container-query-layout/`](/research/responsive-container-query-layout/),
session report `we:reports/2026-06-13-responsive-container-query-layout.md`). No greenfield design is
proposed — the survey found the concern is **already substantially modeled by two existing intents**,
which reshaped the original fork (*new project vs new intent vs `webpositioning`*) into the three forks
below. Each carries a **bold** recommended default.

## What reshaped the question

The book candidate (FlexRow-style flow, `ResizeObserver`, container vs media queries) was filed as
*homeless*, but it decomposes onto two intents already in
[we:src/_data/intents.json](../src/_data/intents.json):

- **`breakpoint`** (status `draft`) — `strategy` (`mobile-first` | `desktop-first` | `strict-range`) +
  semantic `steps` (`compact` | `medium` | `expanded`); its own description already states the steps are
  *"mapped to concrete media/container queries"* by the implementing block. Emits `change`.
- **`layout`** (status `concept`) — app-shell regions: `shell` / `pane` / `dock`, behavior `push` /
  `overlay` / `rail`.

That immediately settles two of the three original options (see Fork 1). Web-platform grounding (2026):
CSS container size queries are Baseline since 2023 (`container-type: inline-size`, `@container`,
`cqi`/`cqw` units); `ResizeObserver` is the imperative substrate; Material 3's Window Size Classes
(compact/medium/expanded/large/extra-large) are the vocabulary `breakpoint` already borrows.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — Placement** | Fold into existing `breakpoint` + `layout` intents (extend, don't create) | New standalone intent | **High** |
| **2 — Viewport vs container scope** | One `breakpoint` intent + a `scope: viewport \| container` dimension | Two separate intents | **Medium** (the real judgment call) |
| **3 — FlexRow primitive** | A deferred `webblocks` block (ResizeObserver = impl substrate) | A `layout`-intent dimension | **Medium** |

---

## Fork 1 — Placement of the responsive-adaptation concern

**Crux:** where does a constraint-based responsive-layout standard live? Refs:
`breakpoint`/`layout` in [we:src/_data/intents.json](../src/_data/intents.json); the
`webpositioning` project ("anchoring a floating element to another element") in
[we:src/_data/projects.json](../src/_data/projects.json).

- **A — Fold into the existing `breakpoint` + `layout` intents (extend, don't create). ✅ default.**
  The two intents already own viewport-tier adaptation and app-shell regions; the candidate adds
  container-scope adaptation (Fork 2) and an optional flow primitive (Fork 3) — both extensions, not a
  new home.
- B — New standalone intent (e.g. `container-adapt` / `intrinsic-layout`). Viable only if container
  scope proves orthogonal to `breakpoint` (decided in Fork 2); otherwise it fragments one concept.
- *Rejected* — **C, new `weblayout` project**: no provider seam, interchange schema, or vendor-interop
  contract to standardize. Responsive layout is UX composition over native CSS — the same
  *"not every gap is a project"* discipline that ruled [#409](/backlog/409-decision-master-detail-intent-vs-project/)
  master-detail down to a plain intent. A project would over-engineer it.
- *Rejected* — **D, fold into `webpositioning`**: that project anchors floating surfaces (tooltips,
  popovers, menus) to a reference element via CSS Anchor Positioning / Floating UI. How a region adapts
  to its available space is an orthogonal concern; conflating them muddies both.

## Fork 2 — Viewport vs container scope: one intent + dimension, or two intents?

**Crux:** `breakpoint` today abstracts viewport tiers. CSS distinguishes `@media` (viewport) from
`@container` (an element's container). Is container scope the *same* axis or a *different* standard? Ref:
`breakpoint.dimensions` in [we:src/_data/intents.json](../src/_data/intents.json) (currently `strategy`,
`steps` — no scope dimension).

- **A — One `breakpoint` intent; add a `scope` dimension (`viewport` | `container`). ✅ default.**
  The semantic-`steps` mental model and the `change` event are identical for both; only the *reference
  frame* differs. `@container` deliberately mirrors `@media` syntax in the platform. This is the textbook
  signature of an axis to **expose as a dimension** (most-flexible default keeps both reachable), not a
  reason to mint a second intent.
- B — A separate container-scope intent, distinct from viewport `breakpoint`. This honours the standing
  *bias-toward-separation*, and the two scopes do have different substrates (media query vs
  `container-type` + `@container`). **This is the genuine judgment the decider owns** — the bias says
  split, but here the shared model and shared native syntax argue the divergence is one dimension, not two
  end-states. Default A unless the decider weights the substrate difference as a true second concern.

## Fork 3 — FlexRow / intrinsic auto-flow primitive: block, layout dimension, or nothing?

**Crux:** FlexRow = a container that flows/wraps its children by available space (intrinsic), using
`ResizeObserver` where declarative CSS can't express the switch. Refs: `layout` intent regions
(shell/pane/dock) in [we:src/_data/intents.json](../src/_data/intents.json); `webblocks` project (status
`concept`) in [we:src/_data/projects.json](../src/_data/projects.json).

- **A — A small deferred `webblocks` block (intrinsic auto-flow container). ✅ default.**
  Realizes `breakpoint` at `scope: container`; native-first default is CSS `@container` / `flex-wrap`,
  with `ResizeObserver` named as the **implementation substrate** (impl-is-not-a-standard — a primitive a
  block calls, like CSS Anchor Positioning under `webpositioning`), not its own protocol. Build is
  deferred until a consumer needs it.
- *Rejected* — **B, a dimension of the `layout` intent**: `layout` is app-shell altitude (drawer / rail /
  pane / dock); FlexRow is content-flow altitude. Folding them violates bias-toward-separation and
  overloads `layout`.
- *Rejected* — **C, nothing (it's just CSS `flex-wrap`)**: the standard-worthy part is the semantic
  vocabulary + the container-query wiring + the ResizeObserver fallback contract, not the flex CSS. A
  consumer can't be *conformant* to "use flexbox."

## What ratifying this means (plan of record, for the decision turn)

- Extend `breakpoint` (we:intents.json): add `scope: { values: [viewport, container] }`, status stays
  `draft`; document container-query resolution. No new project, no new intent.
- Leave `layout` as-is.
- Open/keep a deferred `webblocks` FlexRow block item (Fork 3-A) — not built now.
- This item → `resolved`, `graduatedTo: breakpoint` (the extended intent), at the decision turn.
