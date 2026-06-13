---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-06"
preparedDate: "2026-06-11"
tags: [charts, dataviz, tool-not-lib, standard, json-schema, tool-agnostic, conformance, provider-registry, native-first]
relatedReport: reports/2026-06-11-tool-agnostic-chart-config.md
crossRef: { url: /protocols/, label: Conformance protocols }
---

# Tool-agnostic chart config — a chart described by standard JSON, rendered by any conforming tool

Charts are the essay's **canonical example of "a tool makes more sense than a library"** ([reports/2026-06-06-front-end-platform-book.md:1228-1230](../reports/2026-06-06-front-end-platform-book.md)): charting is so feature-rich any library becomes huge, and you pay for far more than you use. The proposal: define a **tool-agnostic, standard JSON format** describing a chart (data, encodings, axes, interactions, styling intent), let *different tools* render it emitting minimum code per chart, and **score tools on their support for the standard**. **No design exists yet.** The three forks below are grounded in the published [Tool-agnostic Chart Config](/research/tool-agnostic-chart-config/) prior-art survey, each naming a recommended default in **bold**.

The survey separates concerns the item collapsed into one "schema": the **grammar** (the data→encoding→mark mapping every modern tool shares — Wilkinson's Grammar of Graphics), the **contract serialization** (only Vega-Lite is *pure JSON* with no functions, hence the one borrowable contract — Observable Plot is a JS API, Plotly/ECharts are "JSON with callbacks"), the **swap layer** (renderers are providers in a registry + conformance suite — the constellation's existing pattern, cf. Anchor Positioning [protocols.json:21](../src/_data/protocols.json#L21) and Localization [protocols.json:61](../src/_data/protocols.json#L61)), and **accessibility** (the WAI-ARIA Graphics Module + a data-`<table>` derivable from the spec, already expressible via Vega-Lite's `description` channel). The native-first/library-opt-in default is already codified in the adapter layer ([adapters.json:48-59](../src/_data/adapters.json#L48-L59)); no `webcharts` project exists in [projects.json](../src/_data/projects.json), so a project is net-new scaffolding.

### Recommended path at a glance

Ratify all three rows, or override just the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · schema** | **profile Vega-Lite** (pure-JSON, schema-published grammar) | greenfield a chart language *(rejected)* | **High** — only serializable grammar; minimize-lock-in |
| **2 · home** | **Protocol** (`CustomChartRenderer` registry + conformance suite) + optional thin UX intent; project-vs-example deferred | one monolithic intent *(rejected)*; standalone `webcharts` project | **Med** — Protocol is clear; project-vs-example is your call |
| **3 · a11y** | **first-class spec content + weighted conformance axis** (required at L1, graceful degradation) | a11y as a scoring afterthought / baked-only default | **High** — published vocabulary + Vega-Lite proves it lives in-spec |

## Fork 1 — profile an existing grammar, or greenfield a schema?

The grammar of graphics (data field → visual encoding over a mark, scales/axes derived) is shared theory across every modern tool; the differentiator is *serializability*. **Vega-Lite** is the only one that is **pure JSON** — its spec cannot hold functions or custom objects, so it is fully serializable text with a published JSON Schema ([vega.github.io/vega-lite](https://vega.github.io/vega-lite/); the four-tuple `data/transform/mark/encoding`). Observable Plot is a JS API; Plotly and ECharts are "JSON with callbacks" hybrids whose specs embed functions — serializability-breaking, so they're candidate *renderers*, not the contract ([reports/2026-06-11-tool-agnostic-chart-config.md](../reports/2026-06-11-tool-agnostic-chart-config.md), findings 1+3).

- **(A — recommended) Profile Vega-Lite.** Conformance-define a tiered subset/superset; the standardized JSON is the soft, escapable contract; renderers are swappable providers scored by conformance. The value WE adds is the *conformance + renderer-swap + size/a11y comparison* layer, not a new chart language. Cost: authoring the profile + suite. **Sub-decision:** how thin the L1 core is (`data/mark/encoding` + scales/axes/legends only, vs. including selections/transforms/composition at L1).
- **(B) Greenfield a WE chart schema.** Re-derives Wilkinson's grammar at high cost and produces a project-facing format with no interop upside — a refused lock-in. *Rejected* (minimize-lock-in; impl-is-not-a-standard — borrow vocabulary, standardize the meta-schema not the implementation).

## Fork 2 — project, intent, or Protocol? (and where it lives)

The item framed this as "project (`webcharts`?) vs worked example." The survey re-frames it: the essay's actual ask is the **comparison layer** — which tool covers which features at what size/fidelity/a11y — which is the established **provider/registry + conformance** pattern, not a single intent. So the concern factors: a **Protocol** (the renderer-swap contract + conformance suite — the *only* escapable lock, mirroring `CustomPositioner` [protocols.json:21](../src/_data/protocols.json#L21) and the `CustomTranslationProvider` registry [protocols.json:61](../src/_data/protocols.json#L61)), plus optionally a thin **UX intent** for the chart-description authoring surface. The native-first default renderer targets the platform (SVG + ARIA Graphics), with Vega/Plotly/ECharts as opt-in registered adapters ([adapters.json:48-59](../src/_data/adapters.json#L48-L59)).

- **(A — recommended) A `CustomChartRenderer` Protocol** (registry + tiered conformance suite + native-first SVG default + pluggable renderer adapters), optionally plus a thin chart-description intent. **Sub-decision (the item's original fork, now narrowed):** does this earn a **standalone `webcharts` project** (none exists today — net-new scaffolding; justified by a real schema + suite + provider contract) **or** land as a *worked example* under an existing project (webblocks/webvalidation-style conformance)? Lean toward project, but this is the genuine open call — defer to ratification.
- **(B) One monolithic chart intent.** Collapses contract + renderers + scoring into a UX intent, which disclaims technical swap contracts. *Rejected* (bias toward separation; a swap contract is protocol-shaped, not intent-shaped).

## Fork 3 — is accessibility a weighted conformance axis or a baked default?

Charts are a notorious a11y gap and the essay repeatedly prioritizes a11y, but the item left it vague ("weight it heavily"). The survey supplies concrete, borrowable vocabulary: the **WAI-ARIA Graphics Module** roles (`graphics-document`/`graphics-object`/`graphics-symbol`), a **data-`<table>` fallback derivable from the spec's own data+encodings**, and — decisively — Vega-Lite's built-in **`description` encoding channel** that emits ARIA descriptions declaratively ([vega.github.io/vega-lite/docs/encoding](https://vega.github.io/vega-lite/docs/encoding.html)). So accessible output is expressible *in the spec the renderer consumes*, not a side-channel.

- **(A — recommended) First-class spec content + a weighted conformance axis.** The profile carries the `description` channel, the derived data-`<table>` requirement, and ARIA Graphics roles for SVG output; the conformance suite scores each renderer's a11y output as its own weighted dimension. Most-flexible default: **accessible output required at L1**, renderers degrading gracefully.
- **(B) a11y as a scoring afterthought / baked-only default.** Either bolts a11y onto the suite as extra-credit (re-creating the gap) or hardcodes one accessibility behavior with no axis to score renderers against. *Rejected* (most-flexible default — required-at-L1 with graceful degradation; a11y belongs in-spec per Vega-Lite prior art).

## Preserved context — why this fits the constellation

This is the **provider/registry + conformance** pattern applied to dataviz: the JSON is the neutral contract (like the neutral structure in #086), renderers are **swappable providers**, and `/protocols/`-style conformance scores tell you which renderer satisfies which slice of the spec. "Borrow official vocabulary, standardize the meta-schema not the implementation" — with strong prior art (Vega-Lite's grammar of graphics) to borrow rather than invent.

**What it would define:**
- A **chart description schema** — declarative, data-first, tool-independent (a Vega-Lite profile, per fork 1).
- A **conformance suite** (webcases) enumerating chart features, tiered L1+, so renderers can be scored.
- A **renderer provider contract** (`CustomChartRenderer`) — any charting tool that consumes the JSON and renders conformantly drops in (per fork 2).
- Comparison surface: feature support × output size × styling × a11y per renderer (a11y weighted per fork 3).

## Progress

**Status:** open — forks prepared 2026-06-11 (grounded in `relatedReport`; survey published as the [Tool-agnostic Chart Config](/research/tool-agnostic-chart-config/) research topic). Awaiting ratification of the three forks before any authoring build can start.

**Prior partial ruling (2026-06-11, superseded by the prepared shape above):** an earlier note recorded "profile Vega-Lite, scope = project, a11y first-class." The prepared forks keep the Vega-Lite and a11y rulings as recommended defaults but **re-open the home decision** — the survey shows the swap layer is Protocol-shaped, and the project-vs-worked-example call is the genuine remaining fork (Fork 2's sub-decision), not pre-settled.

## Resolution (partial) — 2026-06-11

- **Fork 1 — profile Vega-Lite**: ratified. Vega-Lite is the only pure-JSON, fully-serializable grammar with a published JSON Schema; WE conformance-defines a tiered subset/superset and scores swappable renderers against it rather than greenfielding a new chart language (minimize-lock-in; impl-is-not-a-standard — borrow vocabulary, standardize the meta-schema). The L1-core thinness (`data/mark/encoding` + scales/axes/legends only vs. including selections/transforms/composition) is a follow-on settle within this ratified direction.
- **Fork 2 (Protocol shape) — `CustomChartRenderer` Protocol**: ratified. The renderer-swap contract is the only escapable lock and is protocol-shaped (registry + tiered conformance suite + native-first SVG default + pluggable renderer adapters), mirroring `CustomPositioner` ([protocols.json:21](../src/_data/protocols.json#L21)) and the `CustomTranslationProvider` registry ([protocols.json:61](../src/_data/protocols.json#L61)), optionally plus a thin chart-description UX intent (bias-toward-separation — a swap contract is not intent-shaped).
- **Fork 3 — a11y first-class spec content + weighted conformance axis**: ratified. The profile carries Vega-Lite's `description` channel, the derived data-`<table>` requirement, and WAI-ARIA Graphics roles for SVG output; the conformance suite scores each renderer's a11y output as its own weighted dimension, required at L1 with graceful degradation (most-flexible-default; a11y lives in-spec per Vega-Lite prior art).

**Open — needs a human call:** Fork 2's home sub-decision — does this earn a **standalone `webcharts` project** (none exists today in [projects.json](../src/_data/projects.json) — net-new scaffolding, justified by a real schema + suite + provider contract) **or** land as a **worked example** under an existing project (webblocks/webvalidation-style conformance)? Because this is a net-new project-scope + naming commit and the survey deliberately re-opened it as the genuine remaining fork, it stays a human decision rather than mechanical ratification.
