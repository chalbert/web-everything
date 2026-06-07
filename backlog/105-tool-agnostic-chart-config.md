---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [charts, dataviz, tool-not-lib, standard, json-schema, tool-agnostic, conformance, provider-registry, native-first]
relatedReport: reports/2026-06-06-front-end-platform-book.md
crossRef: { url: /protocols/, label: Conformance protocols }
---

# Tool-agnostic chart standard — a chart described by standard JSON, rendered by any conforming tool

Charts are the essay's **canonical example of "a tool makes more sense than a library"**: charting is so complex and feature-rich that any library becomes huge, and you pay for far more than you use. The proposal: define a **tool-agnostic, standard JSON format** that describes a chart (data, encodings, axes, interactions, styling intent), and let *different tools* render it — emitting the absolute minimum code per chart. Tools can then be **compared on their support for the standard**: which features they cover, the output size they produce, their styling/theming fidelity, accessibility.

## Why this fits the constellation exactly

This is the **provider/registry + conformance** pattern applied to dataviz: the JSON is the neutral contract (like the neutral structure in #086), renderers are **swappable providers**, and `/protocols/`-style conformance scores tell you which renderer satisfies which slice of the spec. It's the "borrow official vocabulary, standardize the meta-schema not the implementation" principle — and there's strong prior art to borrow from (Vega-Lite's grammar of graphics) rather than inventing a schema.

## What it would define

- A **chart description schema** — declarative, data-first, tool-independent.
- A **conformance suite** (webcases) enumerating chart features so renderers can be scored.
- A **renderer provider contract** — any charting tool that consumes the JSON and renders conformantly drops in.
- Comparison surface: feature support × output size × styling × a11y per renderer.

## Open questions

- Adopt/profile **Vega-Lite** (or similar) as the schema rather than greenfield? Strong recommendation: profile an existing grammar; the value here is the *conformance + renderer-swap + size/a11y comparison* layer, not a new chart language.
- Scope: is this a **project** (`webcharts`?) or a worked example of the broader "tool vs. lib" thesis? Lean: a project, because it has a real schema + suite + providers.
- a11y is a first-class axis (the essay repeatedly prioritizes it) — charts are a notorious a11y gap, so the conformance suite should weight accessible output heavily.
