---
bornAs: xy4kshz
kind: decision
status: resolved
dateOpened: "2026-07-13"
dateStarted: "2026-07-14"
dateResolved: "2026-07-15"
graduatedTo: 2510-restructure-plateau-app-into-a-thin-product-shell-coarse-wor
codifiedIn: one-off
preparedDate: "2026-07-14"
researchTopic: product-shell-decomposition
relatedReport: reports/2026-07-14-product-shell-decomposition.md
tags: [product-shell, plateau-app, information-architecture, product-separation, navigation]
---

# Plateau-app product separation — the menu is too big; carve it into distinct products

> **Ruled 2026-07-14 (ratified).** **Fork 1 → thin product shell:** plateau-app becomes a shell; each
> product gets its own route prefix + second-level menu under the existing FUI nav blocks, extractable
> later without a rewrite. Derived rulings inherited: **carve granularity → coarse** (membership falls out
> of the product-vs-tool criterion; mode-not-product escape hatch for same-object surfaces), and
> **Explorer surface name → keep "Explorer"** (internal label, no brand — an external brand stays a
> separate call under `#brand-on-distinctness`). Red-team confirmed at ratification (pass-4 skeptic
> SURVIVES, pass-5 screen clear; nothing new surfaced). Product-IA ruling, not a standard-layer change —
> `codifiedIn: one-off` (no reusable constellation statute; the thin-shell pattern is established prior
> art, applied to plateau-app). Graduates to the build story
> [`2510`](2510-restructure-plateau-app-into-a-thin-product-shell-coarse-wor.md) (restructure into
> the thin shell). Orthogonal to [#2446](/backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-/)
> (Loop code home, still deferred).

plateau-app's sidebar has grown to **~26 nav items across 6 sections**, with one *Tools* section holding
**17 flat entries** ([`plateau-app:index.html:63-81`](../../../plateau-app/index.html)) — the concrete
"menu got too big" symptom. This decides the **shell those surfaces share**: does plateau-app become a
thin product shell (each product a self-contained surface with its own route/menu home, extractable
later), or stay one app whose menu is merely regrouped? Sibling framing to
[#2446](/backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-/) — that decides where
one product's *code* lives; this decides the shell. Plateau Loop (the delivery coordinator,
[#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/)) is one such product;
the autonomous Explorer ([#1167](/backlog/1167-autonomous-explorer/) /
[#1522](/backlog/1522-explorer-captured-gaps-epic/)) is a candidate second.

## Grounding digest

Prior-art survey published at [/research/product-shell-decomposition/](/research/product-shell-decomposition/)
(report: [`we:reports/2026-07-14-product-shell-decomposition.md`](../../reports/2026-07-14-product-shell-decomposition.md)).
Every mature multi-tool suite solves menu bloat the **same** way — a small top-level chooser picks a
product; the product owns its own second-level menu; nobody keeps one flat list. VS Code: Activity Bar →
View Containers → Views. Backstage: an *App* shell orchestrates plugins that each contribute routes/UI,
with an explicit standalone-plugin-vs-card-in-an-existing-surface cut line. single-spa / Module Federation:
the root config *is* the shell (page frame + routing + registration); each product is independently
loadable and knows how to mount/unmount itself — extraction is designed in, not retrofitted. Figma ships
Dev Mode as a **mode over the same file**, not a new product — the escape hatch: same underlying object →
a lens, not a product. **Synthesis criterion:** the shell owns the frame (chrome, top-level nav, routing,
shared auth/theme) and never a product's internals; a surface is a distinct **product** when it is
self-contained, separately route-addressable, and could be extracted — a **tool/view/tab** when it only
makes sense inside another surface.

## Axis framing

After the pass-4 skeptic + pass-5 two-confusion re-attack, **exactly one genuine fork survives**; the two
other candidate axes dissolved to *derived rulings* (see "Derived rulings" below — kept for the record
because the survey settles them, not because the human still chooses):

1. **Shell architecture (the fork)** — plateau-app already bootstraps the FUI nav blocks (`nav:list`,
   `nav:section`, `nav:menubar`) and the droplist menu onto its shared plugs registry
   ([`plateau-app:src/main.ts:71-91`](../../../plateau-app/src/main.ts)), and the sidebar is a single flat
   `nav:list` ([`plateau-app:index.html:50-91`](../../../plateau-app/index.html)) whose 26 `route:link`
   items are gated as one `PRODUCT_ROUTES` block
   ([`plateau-app:src/main.ts:250-258`](../../../plateau-app/src/main.ts)). The mechanics for a thin shell
   already exist — the axis is whether product boundaries become *load-bearing* (own route prefix + own
   second-level menu + independent extraction) or stay *cosmetic* (just `sidebar-section-label` groups).
2. **Carve granularity → derived, not a fork.** The grain is *entailed* by the product-vs-tool criterion
   Fork 1 adopts: apply "is this surface self-contained + separately route-addressable + extractable, or
   does it only make sense inside another surface?" per menu item and coarse membership falls out — fine
   grain requires *ignoring* the criterion. So there is no independent choice to ratify; recorded as a
   derived ruling.
3. **Naming the Explorer surface → derived, not a fork.** Keeping the internal label "Explorer" is a plain
   naming merit call, and minting a distinctive *external* name is a separate future question that
   [`#brand-on-distinctness`](../../docs/agent/platform-decisions.md#brand-on-distinctness) governs on its
   own trigger — not a live either/or here. Recorded as a derived ruling.

**Sequencing is settled, not a fork.** "Loop first, Explorer second" is prioritization, not a design
choice: Loop already has an epic ([#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/))
and a live daemon ([#2449](/backlog/2449-ship-the-phase-1-resident-drain-daemon-merge-queue-only/)), and
the Explorer is the next-most-coherent standalone surface — the *order* carries no ratifiable merit
difference, so it is stated here as context, not a `## Fork`.

## Classification (per-fork 7-question pass)

- **Which layer?** All three axes are **Plateau product-local information architecture** — plateau-app is
  the product. No new WE standard and no new FUI block is minted; the shell *consumes* the existing FUI nav
  blocks already registered at [`plateau-app:src/main.ts:74-91`](../../../plateau-app/src/main.ts). Record:
  this is a product-IA ruling, not a standard-layer decision.
- **Config dimension?** No. Fork 1 (shell architecture) is a one-time product structure commitment, not a
  knob a consumer sets to two legitimate values — it does not route to `#config-extends-platform-default`
  (nor does the granularity ruling).
- **Statute reconciliation (folded into the forks, no collision):**
  - [`#brand-on-distinctness`](../../docs/agent/platform-decisions.md#brand-on-distinctness) governs an
    *externally-marketed product brand* (structural test: ≥1 consumer depends on it **without** the
    parent). This item's "products" are **internal shell surfaces** — a navigable bucket with its own route
    home for the logged-in operator, **not** a brand or npm package. **Citation-scope (corrected on the
    pass-4 re-attack):** the anchor's test keys on an *external* consumer, so it simply **does not reach**
    an internal nav label — it is *not* cited here as authority to forbid or defer any label. It governs
    only the separate, later question of minting an *external* brand for a carved surface (default fold,
    brand on a standalone-external-consumer event). Recorded so ratification never reads "distinct products"
    as "distinct brands."
  - [`#devtools-placement`](../../docs/agent/platform-decisions.md#devtools-placement) already rules a
    developer-operated surface a human runs is "a developer *product* → Plateau" and names "the #1577
    explorer product." This item **operationalizes** that surface as a shell product — downstream of, not
    colliding with, the anchor.
  - **#2446 boundary:** #2446 decides the Loop's *code home*; this decides plateau-app's *internal shell*.
    Orthogonal — the Loop shows as a shell product regardless of where its code lives, and the thin-shell
    default keeps extraction a route-move not a rewrite, so this can ratify while #2446 stays deferred.

## Recommended path at a glance

| Item | Kind | Recommended path |
| --- | --- | --- |
| Shell architecture | **Fork 1 (ratify)** | **Thin product shell** — product boundaries load-bearing, extractable later |
| Carve granularity | derived ruling | **Coarse** — falls out of the product-vs-tool criterion; not an independent fork |
| Explorer surface name | derived ruling | **Keep "Explorer"** — plain naming merit; external brand is a separate later call |

## Fork 1 — shell architecture

*Fork-existence:* two coherent governing models that **cannot both be THE model** — either product
boundaries are load-bearing (own route prefix, own second-level menu, independent extraction) or they are
cosmetic (section labels over one flat list). You commit to one.

- **(default) thin product shell** — plateau-app becomes a shell; each product is a self-contained surface
  with its own route home and its own second-level menu, extractable later without a rewrite. *Grounded:
  every surveyed suite (VS Code, Backstage, single-spa, Atlassian) uses shell+products and designs
  extraction-readiness in; matches "carve into distinct products"; keeps whatever #2446 decides a route-move,
  not a rewrite.*
- **(b) grouped menu only** — keep one app, reorganise the flat `nav:list` into more
  `sidebar-section-label` sections. Weaker: it hides the size symptom without giving products independent
  route homes or lifecycles, and forecloses cheap extraction (the exact retrofit cost the prior art avoids).

Code shape (target thin-shell nav — a product-level `nav:section` per product, second-level owned by the
product, keyed to the FUI blocks already registered at
[`plateau-app:src/main.ts:74-91`](../../../plateau-app/src/main.ts)):

```html
<!-- shell chrome owns only the top-level product chooser -->
<nav class="sidebar-nav" nav:list aria-label="Products">
  <a route:link="/platform" class="nav-item" nav:section>Platform Manager</a>
  <a route:link="/studio" class="nav-item" nav:section>Design-System Studio</a>
  <a route:link="/explorer" class="nav-item" nav:section>Explorer</a>
  <a route:link="/loop" class="nav-item" nav:section>Plateau Loop</a>
  <!-- each product owns its own second-level menu under its route prefix,
       e.g. /explorer/runs, /explorer/history — not hoisted into the shell list -->
</nav>
```

vs the current flat list — 17 sibling `route:link`s under one *Tools* label
([`plateau-app:index.html:63-81`](../../../plateau-app/index.html)) with no route prefix and no per-product
second level.

**Skeptic:** SURVIVES (ran a refute-only sub-agent). Attack (b)-favoring: "thin shell is over-engineering
for one internal app; grouped menu is cheaper and reversible." Two rebuttals: (1) *merit, independent of
cost* — load-bearing boundaries give each product its own route home + second-level menu + cheap
extraction; a cosmetic regroup gives none of that, so the branches differ on capability even if both were
free forever (the pass-5 screen confirmed the merit gap holds at zero cost). (2) *cost, secondary* — the
FUI nav blocks and shared plugs registry are *already* bootstrapped
([`plateau-app:src/main.ts:74-91`](../../../plateau-app/src/main.ts)), so the move is incremental. The
skeptic's surviving caveat, folded in: the real work is restructuring ~20 flat routes into two-level
prefixes (URLs are a contract even internally) — a genuine cost, but a cost critique, not a refutation.
**Screen:** clear (impl: operator-visible, correctly Plateau-side; prio: merit gap survives zero-cost).

## Derived rulings (not forks)

Both started as candidate forks; the pass-4 refute-only skeptic and pass-5 two-confusion screen **dissolved
both** — each has a settled default with no live either/or, so neither is a `## Fork`. Recorded here so the
decision turn ratifies Fork 1 and inherits these as consequences.

### Carve granularity → **coarse** (entailed by Fork 1's criterion)

The grain is not an independent choice: the product-vs-tool criterion Fork 1 adopts *mechanically decides
membership*. Apply "self-contained + separately route-addressable + extractable, else it only makes sense
inside another surface" to each of today's 26 items and coarse buckets fall out — a handful of
workflow-domain products (**Platform Manager**: Catalog + Governance + Compatibility/Impact/Contract-drift/Platform-map;
**Design-System Studio**: the authoring + review tools; **Explorer**: History + Runs; **Plateau Loop**;
plus Brand and Docs), each holding several tools under its own route prefix. "Fine grain" (one product per
tool) requires *ignoring* the criterion — it relabels the flat list as "products," leaves the chooser at
~20 entries, and mis-files tools that only exist inside a workflow (e.g. Weight-Tuning inside review). The
starting membership above is a *guide, refined per surface as each product is carved* — not a frozen
taxonomy. Also apply the **mode-not-product** escape hatch (Figma Dev Mode): a surface over the *same
underlying object* as an existing product ships as a lens/tab inside it, not a new product.
*Skeptic: REFUTED as a fork (grain entailed by the criterion) → demoted; the value "coarse" is correct.
Screen: — (not a fork).*

### Explorer surface name → **keep "Explorer"** (plain naming merit)

The internal surface stays named *Explorer* (route `/explorer`, folding today's Explorer History + Explorer
Runs). Grounded in naming prior art: autonomous-UI-testing tools name on behavior (Applitools Autonomous,
Appvance Bug Hunter, TestSprite) or an agent/persona metaphor (Explorbot); "Explorer" fits the persona
cluster, is not a taken flagship among them, and already matches the tool's name — lowest lock-in, a nav
label renames cheaply. **This is an internal surface label, not a brand.** Minting a distinctive *external*
brand for the Explorer (or any carved surface) is a separate later question governed by
[`#brand-on-distinctness`](../../docs/agent/platform-decisions.md#brand-on-distinctness) on its own
standalone-external-consumer trigger — **out of scope here.**
*Skeptic: REFUTED as a fork — (a) it was a null/timing fork (both branches agreed "don't mint a brand
now"), and (b) the #brand-on-distinctness citation was mis-scoped: its structural test keys on an external
consumer and does not reach an internal nav label, so it cannot be cited as authority to defer a label.
Demoted to a naming ruling on plain merit; the anchor is context for the separate external-brand question,
not authority here. Screen: flagged(prio) → fixed by demotion.*

## Boundaries / lineage

Surfaced 2026-07-12 as operator direction during the first
[#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/) watch run; filed
2026-07-13, prepared 2026-07-14 (`/prepare`). Sibling to
[#2446](/backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-/) (Loop code home,
deferred). Grounds: [/research/product-shell-decomposition/](/research/product-shell-decomposition/),
[`plateau-app:index.html:50-91`](../../../plateau-app/index.html),
[`plateau-app:src/main.ts:71-258`](../../../plateau-app/src/main.ts),
[`#brand-on-distinctness`](../../docs/agent/platform-decisions.md#brand-on-distinctness),
[`#devtools-placement`](../../docs/agent/platform-decisions.md#devtools-placement). Make the call with
`/next decision`.
