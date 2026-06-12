# Tool-agnostic chart config — prior-art survey

**Date**: 2026-06-11
**Point**: Web-platform and library prior art for a tool-agnostic chart-description standard, grounding backlog #105's three open forks (profile an existing grammar vs greenfield; project vs worked example; whether accessibility is a first-class axis or a baked default). The essay names charts as its canonical "a tool makes more sense than a library" example ([front-end-platform-book.md:1228-1230](2026-06-06-front-end-platform-book.md)); the load-bearing question is whether WE coins a chart language or borrows one and contributes only the conformance/renderer-swap/size+a11y comparison layer.
**Backlog item**: `/backlog/105-tool-agnostic-chart-config/`
---

## Question

The essay proposes a tool-agnostic, standard JSON format that describes a chart (data, encodings, axes, interactions, styling intent) so *different tools* render it, each emitting the minimum code per chart, and tools get scored on their support for the standard ([front-end-platform-book.md:1228-1230](2026-06-06-front-end-platform-book.md)). Before authoring an intent/protocol/project standard, survey prior art per [design-first.md](../docs/agent/design-first.md) step 1, so the schema choice reuses platform/ecosystem vocabulary instead of coining a new chart language — and so accessibility, charts' notorious gap, is placed on the right axis.

## Key findings

### 1. There is a mature, JSON-native grammar of graphics to borrow — and it is the only pure-JSON one

The **Grammar of Graphics** (Wilkinson 1999, popularized by ggplot2) is the shared theory behind every modern declarative chart tool: a chart is a mapping from **data fields → visual encodings** (x, y, color, size, shape) over a chosen **mark** (bar, point, line, area), with scales/axes/legends *derived* rather than hand-drawn.

- **Vega-Lite** ([vega.github.io/vega-lite](https://vega.github.io/vega-lite/)) is the high-level grammar of *interactive* graphics expressed as **pure JSON**: a `(data, transform, mark, encoding)` four-tuple, compiled down to lower-level Vega. Crucially, the JSON constraint **cannot accept functions or custom objects** — so a spec is fully serializable text, exactly the "settings saved in a tool-agnostic standard JSON file" the essay asks for. It already publishes a versioned **JSON Schema** ([idl.cs.washington.edu VegaLite InfoVis paper](https://idl.cs.washington.edu/files/2017-VegaLite-InfoVis.pdf)).
- **Observable Plot** ([observablehq.com/@observablehq/plot-vega-lite](https://observablehq.com/@observablehq/plot-vega-lite)) is a *layered* grammar (closer to ggplot2) but is a **JavaScript API**, not a serializable JSON document — it takes functions and DOM. Not a contract format.
- **Plotly** and **ECharts** are **"JSON with callbacks"** hybrids: the spec is a JS config object that *may* include functions and non-primitive values ([npm-compare: chart.js/d3/plotly/vega-lite](https://npm-compare.com/chart.js,d3,plotly.js,vega-lite)). That escape hatch breaks serializability and pins you to one runtime — disqualifying them as the neutral contract, though they remain candidate *renderers*.

**Implication for fork #1:** Vega-Lite is the one prior-art grammar that is both a complete grammar of graphics *and* a pure, serializable, schema-published JSON document. Greenfielding a chart language would re-derive Wilkinson's grammar at high cost and produce a project-facing format with no interop upside — refused under minimize-lock-in. Profile Vega-Lite (a constrained, conformance-defined subset/superset), don't invent.

### 2. The standardized artifact is the contract; renderers are swappable providers — this is the constellation's protocol shape, not a new grammar

The essay's actual ask is not "a chart language" — it's the **comparison layer**: which tool covers which features, at what output size, with what styling fidelity and a11y ([front-end-platform-book.md:1228-1230](2026-06-06-front-end-platform-book.md)). That is precisely the **provider/registry + conformance** pattern already established:

- **Anchor Positioning** ([protocols.json:21](../src/_data/protocols.json#L21)) — one neutral contract (`CustomPositioner`), **native-first** (CSS Anchor Positioning) with **pluggable adapters** (Floating UI) so components share one engine instead of bundling many. Same shape: a neutral chart spec, native-first default renderer, pluggable renderer adapters.
- **Localization** ([protocols.json:61](../src/_data/protocols.json#L61)) — a `CustomTranslationProvider` **registry** with default→project→custom resolution and conformance tiers making vendor catalogs swappable/combinable. A chart-renderer registry is the same machine: `CustomChartRenderer` scored by a conformance suite.
- **Native-first / library opt-in** is already codified in the adapter layer ([adapters.json:48-59](../src/_data/adapters.json#L48-L59), the `lib` provider registry with the Floating-UI adapter): the default renderer should target the **web platform** (SVG + the WAI-ARIA Graphics Module, see finding 4), with Vega/Plotly/ECharts as opt-in registered adapters.

**Implication for fork #2:** the chart concern is **not one intent** — it factors into (a) a *Protocol* (the renderer-swap contract + conformance suite, the only escapable lock) and (b) optionally a thin *UX intent* for the chart-description authoring surface. Whether all this earns a standalone **project** (`webcharts`) vs. lands as a worked example of an existing project is fork #2 proper. Note: no `webcharts` project exists in [projects.json](../src/_data/projects.json) today, so a project is net-new scaffolding.

### 3. The schema decomposes into a stable native-aligned core plus tool-specific extensions — profile, don't adopt whole

Vega-Lite is large (selections, transforms, layering, faceting, concat). A WE *profile* would conformance-define a tiered core — `(data, mark, encoding)` + scales/axes/legends as the L1 baseline every renderer must satisfy — and treat interactions/transforms/composition as higher tiers a renderer *may* satisfy and be scored on. This mirrors the existing protocol conformance-tier idiom ([protocols.json:5](../src/_data/protocols.json#L5), validation L1/L2/L3) and the capabilityMatrix "an impl satisfies a standard" framing (a renderer is an impl that satisfies the chart spec at some tier, **not** itself a standards artifact).

### 4. Accessibility is a real, separable axis with published platform vocabulary — and Vega-Lite already proves it belongs IN the spec

Charts are a notorious a11y gap, and the essay repeatedly prioritizes a11y. The platform and prior art give concrete, borrowable vocabulary rather than a vague "weight it heavily":

- **WAI-ARIA Graphics Module** (W3C, 2018, Bellamy-Royds) — standard roles `graphics-document` / `graphics-object` / `graphics-symbol` for SVG charts ([data.europa.eu accessible-svg-and-aria](https://data.europa.eu/apps/data-visualisation-guide/accessible-svg-and-aria); [W3C SVG accessibility chart taxonomy](https://www.w3.org/wiki/SVG_Accessibility/ARIA_chart_taxonomy_discussion)).
- **Data-table alternative** — the consensus fallback is a real `<table>` of the underlying data, since alt text alone is insufficient ([sarasoueidan.com Khan Academy case study](https://www.sarasoueidan.com/blog/accessible-data-charts-for-khan-academy-2018-annual-report/); [tenon.io accessible charts with ARIA](https://blog.tenon.io/accessible-charts-with-aria/)). The chart spec already *has* the data + encodings, so the table is **derivable from the spec** — an a11y output every conforming renderer can be required to emit.
- **ARIA live regions + sonification** for dynamic/interactive charts ([data.europa.eu](https://data.europa.eu/apps/data-visualisation-guide/accessible-svg-and-aria)).
- **Decisive prior art:** Vega-Lite ships a built-in **`description` encoding channel** that emits ARIA descriptions, auto-generates a description from the encoding by default, and gates it via `config.aria` / `mark.aria` ([vega.github.io/vega-lite/docs/encoding](https://vega.github.io/vega-lite/docs/encoding.html)). So accessible output is **expressible declaratively in the spec the renderer consumes** — it does not need a separate side-channel.

**Implication for fork #3:** a11y is not a scoring afterthought *bolted onto* the conformance suite, nor a single baked default — it is a **first-class part of the spec and a weighted conformance dimension**. The grounded shape: the profile carries a11y vocabulary (description channel, derived data-table requirement, ARIA Graphics roles for SVG output), and the conformance suite scores each renderer's a11y output as its own weighted axis. The most-flexible default is "accessible output required at L1" with renderers degrading gracefully, not "a11y optional/extra-credit."

### 5. Native baseline: there is no native chart element; SVG/Canvas + ARIA Graphics is the floor

The web platform ships **no chart primitive** — charts are SVG (or Canvas) drawn by JS. The native-first baseline is therefore SVG + the WAI-ARIA Graphics Module + a data-`<table>` fallback; heavyweight renderers (Vega, Plotly, ECharts) are opt-in adapters layered over that floor, consistent with the native-first/library-opt-in default already codified for positioning ([adapters.json:48-59](../src/_data/adapters.json#L48-L59)).

## Recommendation (to ratify in #105)

1. **Profile Vega-Lite** (a conformance-tiered subset/superset), do **not** greenfield a chart language. It is the only pure-JSON, schema-published grammar of graphics; the standardized JSON is the soft/escapable contract, renderers are swappable providers. *Sub-decision:* how thin the L1 core is (just `data/mark/encoding` + scales/axes vs. including selections/transforms).
2. **Factor into a Protocol** (`CustomChartRenderer` registry + conformance suite, native-first SVG default, pluggable Vega/Plotly/ECharts adapters), optionally plus a thin UX chart-description intent — and decide whether that earns a standalone **`webcharts` project** (net-new; none exists) vs. lands as a worked example under an existing project (e.g. webblocks/webvalidation-style conformance).
3. **Accessibility = first-class spec content + weighted conformance axis**, not a baked default — carry the `description` channel, a renderer-derived data-`<table>`, and ARIA Graphics roles in the profile; require accessible output at L1 with graceful degradation.

## Files Created/Modified

| File | Action |
| --- | --- |
| `reports/2026-06-11-tool-agnostic-chart-config.md` | Created (this report) |
