---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-11"
dateResolved: "2026-06-11"
tags: [compound-children, jsx-adapter, lowering, render-strategy, protocol-seed]
---

# Specify the compound-child to options-array lowering under the JSX adapter

Specify the one real conformance contract behind the **Compound Child** paradigm (decided in #258): how a parent's authored children (`<segment>`, `<option>`) lower to an `options` array under the JSX adapter, rather than rendering as child components. Define the authoring shape (which attributes/text map to `value`, `label`, `disabled`, `selected`), the lowering rule, and round-trip reversibility/lossiness. This is the **latent protocol seed** — if independent vendors later need to interoperate on the child-authoring shape, this spec graduates to a first-class `compound-child` protocol. Standalone (writable as an adapter convention before any render-strategy protocol), but should align with the **Lowering** / **Render Strategy** semantics.

## Context

#258 settled that "compound child → option" is a shared **semantics paradigm** (the `Compound Child` glossary term), cross-referenced by the Selection Intent and option-bearing blocks — not a new UX intent and not (yet) its own protocol. The deferral was deliberate: a protocol is the one real lock-in, and there is no proven multi-vendor interop demand. The exception flagged in #258's pre-decision checks is the **lowering contract**: "authored children lower to an `options` array under the JSX adapter" is *named* in the `Compound Child` semantics term and the Segmented Control block description, but **specified nowhere**. This item fills that gap.

## Worked examples

Each example is **authored HTML (left) ⇄ lowered JSX `options` (right)** — the translation this item must specify. They are illustrative starting points, not the ratified contract. Status legend: **✓ real** (block exists in the repo), **native** (HTML precedent), **✗ candidate** (plausible future block).

### Strict compound-child — positional children declare the options

**Segmented Control** ✓ — each child → one `options[]` entry: `value` attr → value, text → label, `disabled` → state; `selected`/pressed child lifts to the parent's `value`. *(`we:src/_includes/block-descriptions/segmented-control.njk`)*

<table>
<thead><tr><th>Authored HTML</th><th>Lowered JSX (<code>options</code>)</th></tr></thead>
<tbody><tr>
<td>

```html
<segmented-control name="view"
    selection="model=single;immediacy=live">
  <segment value="list" selected>List</segment>
  <segment value="grid">Grid</segment>
  <segment value="map" disabled>Map</segment>
</segmented-control>
```

</td>
<td>

```jsx
<SegmentedControl name="view" value="list"
  selection={{ model: "single", immediacy: "live" }}
  options={[
    { value: "list", label: "List" },
    { value: "grid", label: "Grid" },
    { value: "map",  label: "Map", disabled: true },
  ]} />
```

</td>
</tr></tbody>
</table>

**Radio Group** ✗ candidate — same shape, radio affordance.

<table>
<thead><tr><th>Authored HTML</th><th>Lowered JSX (<code>options</code>)</th></tr></thead>
<tbody><tr>
<td>

```html
<radio-group name="plan" selection="model=single">
  <radio value="free">Free</radio>
  <radio value="pro" checked>Pro</radio>
</radio-group>
```

</td>
<td>

```jsx
<RadioGroup name="plan" value="pro" options={[
  { value: "free", label: "Free" },
  { value: "pro",  label: "Pro" },
]} />
```

</td>
</tr></tbody>
</table>

**Toggle Group** ✗ candidate — `model=multiple`, so the lifted value is an **array**.

<table>
<thead><tr><th>Authored HTML</th><th>Lowered JSX (<code>options</code>)</th></tr></thead>
<tbody><tr>
<td>

```html
<toggle-group selection="model=multiple">
  <toggle value="bold" pressed>Bold</toggle>
  <toggle value="italic">Italic</toggle>
  <toggle value="underline" pressed>Underline</toggle>
</toggle-group>
```

</td>
<td>

```jsx
<ToggleGroup selection={{ model: "multiple" }}
  value={["bold", "underline"]}
  options={[
    { value: "bold",      label: "Bold" },
    { value: "italic",    label: "Italic" },
    { value: "underline", label: "Underline" },
  ]} />
```

</td>
</tr></tbody>
</table>

**Stepper / Wizard** ✗ candidate — current step lifts to `value`; `aria-current` is derived.

<table>
<thead><tr><th>Authored HTML</th><th>Lowered JSX (<code>options</code>)</th></tr></thead>
<tbody><tr>
<td>

```html
<stepper value="payment">
  <step value="account">Account</step>
  <step value="payment">Payment</step>
  <step value="confirm">Confirm</step>
</stepper>
```

</td>
<td>

```jsx
<Stepper value="payment" options={[
  { value: "account", label: "Account" },
  { value: "payment", label: "Payment" },
  { value: "confirm", label: "Confirm" },
]} />
```

</td>
</tr></tbody>
</table>

### Native HTML precedents

**`<select>` / `<option>`** native — the canonical precedent the paradigm generalizes.

<table>
<thead><tr><th>Authored HTML</th><th>Lowered JSX (<code>options</code>)</th></tr></thead>
<tbody><tr>
<td>

```html
<select name="size">
  <option value="s">Small</option>
  <option value="m" selected>Medium</option>
  <option value="l" disabled>Large</option>
</select>
```

</td>
<td>

```jsx
<Select name="size" value="m" options={[
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large", disabled: true },
]} />
```

</td>
</tr></tbody>
</table>

**`<optgroup>`** native — grouping is a **second structural axis** (nested option list); orthogonal to Selection's `grouping` dimension, which only *arranges*.

<table>
<thead><tr><th>Authored HTML</th><th>Lowered JSX (<code>options</code>)</th></tr></thead>
<tbody><tr>
<td>

```html
<select name="country">
  <optgroup label="North America">
    <option value="ca">Canada</option>
    <option value="us">United States</option>
  </optgroup>
  <optgroup label="Europe">
    <option value="fr">France</option>
  </optgroup>
</select>
```

</td>
<td>

```jsx
<Select name="country" options={[
  { group: "North America", options: [
    { value: "ca", label: "Canada" },
    { value: "us", label: "United States" },
  ]},
  { group: "Europe", options: [
    { value: "fr", label: "France" },
  ]},
]} />
```

</td>
</tr></tbody>
</table>

**`<datalist>` / `<option>`** native — value-only options (no label text).

<table>
<thead><tr><th>Authored HTML</th><th>Lowered JSX (<code>options</code>)</th></tr></thead>
<tbody><tr>
<td>

```html
<input list="browsers">
<datalist id="browsers">
  <option value="Chrome">
  <option value="Firefox">
  <option value="Safari">
</datalist>
```

</td>
<td>

```jsx
<input list="browsers" />
<Datalist id="browsers" options={[
  { value: "Chrome" },
  { value: "Firefox" },
  { value: "Safari" },
]} />
```

</td>
</tr></tbody>
</table>

### Droplist family ✓ real — already an `options` array in production

These blocks already data-bind an `options` array (rendered via `<template for-each>`); the substrate below shows the equivalent authored shape. They confirm the lowered form is the *native* shape here, and the authored children are the lift target.

**Dropdown** ✓ (`single`) — `data-value` → value, text → label. *(`we:dropdown.njk`)*

<table>
<thead><tr><th>Authored HTML (substrate)</th><th>Lowered JSX (<code>options</code>)</th></tr></thead>
<tbody><tr>
<td>

```html
<ul role="listbox" selection="model=single">
  <li role="option" data-value="ar">Argentina</li>
  <li role="option" data-value="au">Australia</li>
</ul>
```

</td>
<td>

```jsx
<Dropdown selection={{ model: "single" }} options={[
  { value: "ar", label: "Argentina" },
  { value: "au", label: "Australia" },
]} />
```

</td>
</tr></tbody>
</table>

**Multi-Select Dropdown** ✓ (`multiple`) — selection set lifts to an array. *(`we:multi-select-dropdown.njk`)*

<table>
<thead><tr><th>Authored HTML (substrate)</th><th>Lowered JSX (<code>options</code>)</th></tr></thead>
<tbody><tr>
<td>

```html
<ul role="listbox" aria-multiselectable="true"
    selection="model=multiple">
  <li role="option" data-value="design" aria-selected="true">Design</li>
  <li role="option" data-value="eng">Engineering</li>
</ul>
```

</td>
<td>

```jsx
<MultiSelect selection={{ model: "multiple" }}
  value={["design"]}
  options={[
    { value: "design", label: "Design" },
    { value: "eng",    label: "Engineering" },
  ]} />
```

</td>
</tr></tbody>
</table>

### Hierarchical — a second nesting axis

**Tree-Select** ✗ candidate — children nest, so options carry `children`. This is the same structural-recursion question as `<optgroup>` but unbounded depth.

<table>
<thead><tr><th>Authored HTML</th><th>Lowered JSX (<code>options</code>)</th></tr></thead>
<tbody><tr>
<td>

```html
<tree-select selection="model=single">
  <tree-item value="fruit">Fruit
    <tree-item value="apple">Apple</tree-item>
    <tree-item value="pear">Pear</tree-item>
  </tree-item>
  <tree-item value="veg">Vegetable</tree-item>
</tree-select>
```

</td>
<td>

```jsx
<TreeSelect selection={{ model: "single" }} options={[
  { value: "fruit", label: "Fruit", children: [
    { value: "apple", label: "Apple" },
    { value: "pear",  label: "Pear" },
  ]},
  { value: "veg", label: "Vegetable" },
]} />
```

</td>
</tr></tbody>
</table>

### Authoring preference — the lowered child *dialect*

The `options` array is not the only valid JSX target. React authors typically expect **compound components** — `<Stepper.Option>` subcomponents authored as children — over a flat data prop. Both are faithful lowerings of the same authored HTML; which one the adapter emits should be a **soft authoring preference** — a second axis of the dev-authoring-preferences program (#150), the way its first shipped preference, the JSX `dialect` (#235, [`we:dialect.ts`](../blocks/renderers/jsx/dialect.ts)), already lets `html` vs `react` govern attribute *spelling*. The difference: that axis only changes attribute names ("the tree is identical"); this one changes the **child tree's shape**, so it is a *new, orthogonal* structural dialect, not covered by today's `JsxDialect`.

The value space is `options` (flat data prop) vs `compound` (subcomponents). Crucially, **the default is not baked into the adapter** — like intents, and because defaults live in a project config that extends the platform default, the adapter stays default-less and *resolves* the dialect from a development-preference config the project extends in a chain (`team → business line → company → one of many base configs offered online`). `options` is what a sensible base config sets at the root of that chain (native-/static-first), not a constant in the adapter; any layer can override it, and a project can pick a different base config entirely. It is a *soft* preference, not a protocol — by #150's test (breaks interop → Protocol/enforced; merely offends a convention → soft preference/adapter-lowered, opt-in, never forced), so any enforcement lowers into an incumbent linter, never a WE-specific "sheriff". (Today's `DEFAULT_DIALECT = 'html'` constant in `we:dialect.ts` is exactly the baked-in shortcut this model dissolves into a base config — the same registry-alignment cleanup tracked in #243, where render-strategy is the known outlier.)

<table>
<thead><tr><th><code>options</code> dialect (base-config default)</th><th><code>compound</code> dialect (opt-in via config)</th></tr></thead>
<tbody><tr>
<td>

```jsx
<Stepper value="payment" options={[
  { value: "account", label: "Account" },
  { value: "payment", label: "Payment" },
  { value: "confirm", label: "Confirm" },
]} />
```

</td>
<td>

```jsx
<Stepper value="payment">
  <Stepper.Option value="account">Account</Stepper.Option>
  <Stepper.Option value="payment">Payment</Stepper.Option>
  <Stepper.Option value="confirm">Confirm</Stepper.Option>
</Stepper>
```

</td>
</tr></tbody>
</table>

Both lower from the *same* authored `<stepper>`/`<step>` HTML. The `compound` form is near-identity with the source tree (each `<step>` → one `<Stepper.Option>`), so it round-trips most cleanly — and, crucially, its children are JSX, which resolves the lossy boundary below.

### The lossy boundary — the core question

A plain-text child round-trips cleanly (`<option value="m">Medium</option>` ⇄ `{ value: "m", label: "Medium" }`). It breaks once a child carries **rich content**: in the `options` dialect a flat `label` string can't hold markup, so the lowering must either flatten to text (lossy) or carry a **render slot** (below). The `compound` dialect sidesteps this entirely — subcomponent children are JSX and hold the markup verbatim — which is a strong argument for making the dialect author-selectable rather than fixing the `options` form. Pinning this down is the heart of the contract.

Take the same rich-content authored child and lower it under each dialect:

```html
<segmented-control name="view">
  <segment value="grid">
    <svg aria-hidden="true">…</svg>
    Grid <kbd>⌘2</kbd>
  </segment>
</segmented-control>
```

<table>
<thead><tr><th><code>options</code> dialect — needs a render slot</th><th><code>compound</code> dialect — lossless by construction</th></tr></thead>
<tbody><tr>
<td>

```jsx
<SegmentedControl name="view" options={[
  {
    value: "grid",
    // label: "Grid"  ← lossy: drops <svg> + <kbd>
    render: () => <><GridIcon /> Grid <kbd>⌘2</kbd></>,
  },
]} />
```

</td>
<td>

```jsx
<SegmentedControl name="view">
  <SegmentedControl.Segment value="grid">
    <GridIcon /> Grid <kbd>⌘2</kbd>
  </SegmentedControl.Segment>
</SegmentedControl>
```

</td>
</tr></tbody>
</table>

### Contrast — Tabs does *not* lower to options (out of scope)

Tabs binds triggers and panels by **attribute** (`tab-trigger`/`tab-panel`) across arbitrary, separated elements — a panel needn't be a direct child. So it keeps **structural children** under the adapter and does **not** collapse to an `options` array. It maps markup to a value model, but it is a related-but-distinct shape, not an instance of this lowering. *(`we:tabs.njk`)*

<table>
<thead><tr><th>Authored HTML</th><th>JSX — children preserved (no options array)</th></tr></thead>
<tbody><tr>
<td>

```html
<div tab-group>
  <nav tab-list>
    <button tab-trigger="counter">Counter</button>
  </nav>
  <div tab-panels>
    <section tab-panel="counter">…</section>
  </div>
</div>
```

</td>
<td>

```jsx
<TabGroup>
  <TabList>
    <Tab for="counter">Counter</Tab>
  </TabList>
  <TabPanels>
    <TabPanel name="counter">…</TabPanel>
  </TabPanels>
</TabGroup>
```

</td>
</tr></tbody>
</table>

## Scope

- **Authoring → value-model mapping.** For the strict positional compound-child shape (`<segment>`, native `<option>`): which child attribute or text content maps to each `options[]` field (`value`, `label`, `disabled`, `selected`/pressed, any per-option metadata). Note explicitly where Tabs is *out of scope* — it binds via `tab-trigger`/`tab-panel` attributes on arbitrary elements, not positional children (see #258), so it is a related-but-distinct shape, not an instance of this lowering.
- **The lowering rule.** How the JSX adapter recognizes a parent's compound children and lowers them to the chosen JSX surface. Where this sits relative to the `Lowering` semantics term and the Render Strategy cross-strategy compiler.
- **The child-materialization dialect (authoring preference).** Define a *new structural dialect axis* — `options` (flat data prop) vs `compound` (`<Parent.Option>` subcomponents) — distinct from the existing attribute-spelling dialect (#235, `html`/`react`), which leaves the tree identical. Specify: the value space; that the adapter is **default-less** and resolves the preference from a config the project extends in a chain (`team → business line → company → a base config offered online`) — defaults live in a project config that extends the platform default, mirroring intents — `options` is what a base config sets at the root, not a constant in the adapter; that it is a *soft* preference, not a protocol; and that the `compound` form is the lossless answer to rich-content children. Confirm both forms accept on **input** (round-trip) regardless of which the config selects for codegen, mirroring how `jsxToHtml` already ingests either attribute dialect. This is a soft preference per #150's protocol-vs-preference test (so enforcement, if any, lowers into an incumbent linter, not a WE sheriff). Note the alignment task: fold today's baked `DEFAULT_DIALECT` into the base config — same cleanup as #243 (registry config-extends-platform-default migration).
- **Round-trip / lossiness.** Whether children ⇄ options is reversible (per the Lowering term, structural control-flow lowers reversibly; some boundaries are lossy) and what is dropped if not.
- **Protocol-graduation note.** Record what would have to be true (independent-vendor interop demand) for this spec to become a first-class `compound-child` protocol, and that its natural owner would be the render-strategy / component-compiler path — not Selection.

## Out of scope

- Minting the protocol itself (deferred in #258 until interop demand is proven).
- Tabs' attribute-binding model (distinct shape; documented under the Tabs block).

## Progress

- **Status:** resolved 2026-06-11 (batch `batch-2026-06-11`). Spec-only authoring item; the contract is ratified into the semantics glossary (the canonical home, since the paradigm "lives as a semantics term" per #258), with the worked authoring⇄JSX examples above preserved here as the design record.
- **Done — specified the contract as two new semantics terms (`we:src/_data/semantics.json`), auto-rendered at `/semantics/`:**
  - **`Compound-Child Lowering`** — the conformance contract: the authoring→value-model field mapping (`value`/`label`/`disabled`, `selected`/`checked`/`pressed` → lifted parent `value`, array when `model=multiple`), the grouping/hierarchy second structural axis, the lowering rule, round-trip reversibility (plain-text reversible; rich-markup lossy → render slot / `compound` form), the explicit Tabs-out-of-scope note, and the protocol-graduation condition (proven multi-vendor interop demand; owner = render-strategy / component-compiler path, not Selection).
  - **`Child-Materialization Dialect`** — the *new structural* authoring-preference axis: `options` (flat data prop) vs `compound` (`<Parent.Option>` subcomponents), distinct from the attribute-spelling JSX dialect (#235, which leaves the tree identical); default-less (resolved from a project-extended config chain, `options` set by the base config not the adapter); a soft preference not a protocol (#150 test → enforcement lowers into an incumbent linter); input accepts either form (round-trip); alignment task to fold `DEFAULT_DIALECT` into the base config noted (#243).
  - Updated the existing **`Compound Child`** term's pointer from "tracked separately as the latent protocol seed" to link the two new terms.
- **Gate:** `check:standards` green; `/semantics/` renders the new terms (probed 200).
