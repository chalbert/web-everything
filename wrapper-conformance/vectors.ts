/**
 * Behavioral wrapper conformance vectors (#891, ratified by #855 B2 — WE owns the wrapper *contract*,
 * not the codegen). Each vector is a hand-written CEM custom-element fixture (tagName + attributes +
 * properties + events + slots) paired with the runtime behaviour a conformant framework wrapper
 * (React/Vue/…) must reproduce. The vectors are the WE-owned, generator-AGNOSTIC contract: FUI's
 * generator stays swappable because its output is judged only against these (the #506 golden-vectors
 * model, applied to behaviour instead of bytes). Synthetic fixtures — no dependency on the authored
 * `blocks.json` CEM (#822).
 *
 * The five behaviours a wrapper must satisfy (the #855/#821 contract):
 *   1. renders the host custom element (the `tagName`),
 *   2. forwards string attributes verbatim,
 *   3. assigns rich properties as DOM *properties* (never serialized to an attribute),
 *   4. bridges host CustomEvents to handler props,
 *   5. projects slotted children into the host's light DOM.
 *
 * Front-A conformance currency (framework-churn watch #1258 — verified 2026-06-20 against React 19,
 * Vue 3.5 + Vapor, Angular 20 zoneless, Svelte 5 runes, #1273): the five-behaviour contract is
 * version-AGNOSTIC and remains correct — it is exactly what "Custom Elements Everywhere" tests, so no
 * vector change is needed as majors move. The notable shift is that frameworks now satisfy the contract
 * NATIVELY: React 19 passes Custom Elements Everywhere (behaviours 3 + 4 — rich props as DOM properties,
 * CustomEvent bridging — were React's historical gaps and React 19 closes them), so a React wrapper is now
 * largely OPTIONAL (#1271) — needed only for genuine residual gaps (e.g. SSR prop hydration), not as the
 * default consumption path. The wrapper contract here still defines what a wrapper MUST do when one is used.
 */

/** A custom event the host emits → the wrapper must bridge it to a framework handler prop. */
export interface VectorEvent {
  /** The DOM event the host element dispatches. */
  event: string;
  /** The wrapper prop a conformant wrapper invokes when the event fires (e.g. `onChange`). */
  handlerProp: string;
  /** The `CustomEvent.detail` payload the runner dispatches; the handler must receive it intact. */
  detail?: unknown;
}

/** A slotted child a conformant wrapper must project into the host element's light DOM. */
export interface VectorSlot {
  /** Named slot target (`slot="…"`); omitted = the default slot. */
  name?: string;
  /** The markup the wrapper projects (asserted present in the host's light DOM). */
  html: string;
}

/** One behavioral conformance vector — a CEM custom-element fixture + the behaviour a wrapper owes it. */
export interface WrapperVector {
  /** Stable vector id (used in the report). */
  name: string;
  /** The host custom-element tag the wrapper must render. */
  tagName: string;
  /** String attributes forwarded verbatim → asserted via `getAttribute`. */
  attributes?: Record<string, string>;
  /** Rich properties assigned as DOM properties → asserted via `el[prop]` AND `getAttribute(prop) == null`. */
  properties?: Record<string, unknown>;
  /** Host CustomEvents → handler-prop bridges. */
  events?: VectorEvent[];
  /** Light-DOM projection. */
  slots?: VectorSlot[];
}

/**
 * The corpus. Small and behaviour-focused — each vector isolates a behaviour while the `combo` vector
 * exercises all five together (the real-wrapper shape). Add a vector when a new wrapper behaviour
 * enters the contract; the runner drives every one against any candidate wrapper.
 */
export const WRAPPER_VECTORS: WrapperVector[] = [
  {
    // 1+2 — bare element with forwarded string attributes.
    name: 'attributes-forwarded',
    tagName: 'we-button',
    attributes: { variant: 'primary', disabled: '' },
  },
  {
    // 3 — a rich property (array) assigned as a DOM property, NOT serialized to an attribute.
    name: 'rich-property-assigned',
    tagName: 'we-autocomplete',
    properties: { items: ['alpha', 'beta', 'gamma'], selectedIndex: 1 },
  },
  {
    // 4 — a host CustomEvent bridged to a handler prop, detail intact.
    name: 'event-bridged',
    tagName: 'we-autocomplete',
    events: [{ event: 'we-change', handlerProp: 'onChange', detail: { value: 'beta' } }],
  },
  {
    // 5 — default + named slot projection.
    name: 'slots-projected',
    tagName: 'we-dialog',
    slots: [
      { html: '<p>Body content</p>' },
      { name: 'footer', html: '<button>OK</button>' },
    ],
  },
  {
    // all five together — the shape a generated wrapper faces in practice.
    name: 'combo',
    tagName: 'we-autocomplete',
    attributes: { placeholder: 'Search…' },
    properties: { items: [{ id: 1, label: 'One' }], open: true },
    events: [{ event: 'we-select', handlerProp: 'onSelect', detail: { id: 1 } }],
    slots: [{ name: 'prefix', html: '<span class="icon">🔍</span>' }],
  },
];
