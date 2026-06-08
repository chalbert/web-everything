/**
 * Shared model-analyzer fixtures — backlog #188. The single source of model-path examples for BOTH
 * the Code Upgrader Playground demo and the conformance unit suite, so the demo's badges and CI run
 * the exact same engine on the exact same (input, canned-model-response) pairs (anti-drift split).
 *
 * Each case is a snippet of *messier* legacy source the deterministic reference analyzer rejects,
 * paired with the raw text a model returns for it. The good cases prove a model resolves dynamics
 * into a faithful, verified `<component>`; the hallucination cases prove the moat — each is rejected
 * by a different layer (model JSON validation, model interpolation guard, the engine's intent check,
 * the engine's parse check), so a model that invents bad structure is never offered.
 */

/** Standard intents the model may reference — shared by the demo and the suite's verify gate. */
export const knownModelIntents = ['disclosure', 'selection'] as const;

export interface ModelCase {
  id: string;
  title: string;
  note?: string;
  /** The messier legacy source (out of the reference subset — escalates to the model). */
  source: string;
  /** The raw completion the scripted model returns for this source. */
  modelResponse: string;
  /** Does the verify gate offer the result? `false` = a hallucination the gate must reject. */
  expectOffered: boolean;
  expectName?: string;
  expectShadow?: 'open' | 'closed' | 'none';
  /** Substring expected in the diagnostics when not offered (which layer caught it). */
  expectDiagnostic?: string;
}

export const modelCases: ModelCase[] = [
  {
    id: 'dynamic-resolved',
    title: '1 · Dynamic template → resolved to slots (offered)',
    note: 'The `${this.getAttribute(…)}` template the reference analyzer rejects; the model resolves it to a static <slot>.',
    source:
      `class GreetUser extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.attachShadow({ mode: 'open' });\n` +
      "    this.shadowRoot.innerHTML = `<p>Hello ${this.getAttribute('name')}</p>`;\n" +
      `  }\n` +
      `}\n` +
      `customElements.define('greet-user', GreetUser);`,
    modelResponse: JSON.stringify({
      name: 'greet-user',
      shadow: 'open',
      template: '<p>Hello <slot name="name">there</slot></p>',
      notes: ['resolved ${getAttribute("name")} to a named slot'],
    }),
    expectOffered: true,
    expectName: 'greet-user',
    expectShadow: 'open',
  },
  {
    id: 'multi-innerhtml-resolved',
    title: '2 · Multi-step innerHTML → merged template (offered)',
    note: 'Two innerHTML assignments — beyond the single-assignment reference subset; the model merges them into one declarative template.',
    source:
      `class StatusCard extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.innerHTML = '<h3>Status</h3>';\n` +
      `    this.innerHTML += '<p class=\"body\"><slot></slot></p>';\n` +
      `  }\n` +
      `}\n` +
      `customElements.define('status-card', StatusCard);`,
    modelResponse:
      '```json\n' +
      JSON.stringify({
        name: 'status-card',
        shadow: 'none',
        template: '<h3>Status</h3><p class="body"><slot></slot></p>',
      }) +
      '\n```',
    expectOffered: true,
    expectName: 'status-card',
    expectShadow: 'none',
  },
  {
    id: 'hallucinated-prose',
    title: '3 · Model returns prose, not JSON (rejected)',
    note: 'Caught by the model-output validator before the engine runs — not a valid JSON object.',
    source:
      `class FancyThing extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.attachShadow({ mode: 'open' });\n` +
      "    this.shadowRoot.innerHTML = `<div>${this.value}</div>`;\n" +
      `  }\n` +
      `}\n` +
      `customElements.define('fancy-thing', FancyThing);`,
    modelResponse: 'Sure! This is a simple component that renders a div. Let me know if you need anything else.',
    expectOffered: false,
    expectDiagnostic: 'valid JSON',
  },
  {
    id: 'hallucinated-interpolation',
    title: '4 · Model leaves `${…}` unresolved (rejected)',
    note: 'The model returned JSON but failed to resolve the dynamic template — caught by the interpolation guard.',
    source:
      `class PriceTag extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.attachShadow({ mode: 'open' });\n` +
      "    this.shadowRoot.innerHTML = `<b>$${this.price}</b>`;\n" +
      `  }\n` +
      `}\n` +
      `customElements.define('price-tag', PriceTag);`,
    modelResponse: JSON.stringify({ name: 'price-tag', shadow: 'open', template: '<b>$${this.price}</b>' }),
    expectOffered: false,
    expectDiagnostic: 'interpolation',
  },
  {
    id: 'hallucinated-intent',
    title: '5 · Model references a non-standard intent (rejected)',
    note: "Valid JSON and template, but it claims an intent the standard doesn't have — caught by the engine's intent check.",
    source:
      `class TeleportBox extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.attachShadow({ mode: 'open' });\n` +
      "    this.shadowRoot.innerHTML = `<div>${this.dest}</div>`;\n" +
      `  }\n` +
      `}\n` +
      `customElements.define('teleport-box', TeleportBox);`,
    modelResponse: JSON.stringify({
      name: 'teleport-box',
      shadow: 'open',
      template: '<div><slot></slot></div>',
      intents: ['teleport'],
    }),
    expectOffered: false,
    expectDiagnostic: 'teleport',
  },
  {
    id: 'hallucinated-bad-name',
    title: '6 · Model invents an invalid tag name (rejected)',
    note: 'A custom-element name with no hyphen — valid-looking JSON, but the engine’s parse check refuses the generated <component>.',
    source:
      `class Widget extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.attachShadow({ mode: 'open' });\n` +
      "    this.shadowRoot.innerHTML = `<span>${this.label}</span>`;\n" +
      `  }\n` +
      `}\n` +
      `customElements.define('my-widget', Widget);`,
    modelResponse: JSON.stringify({ name: 'widget', shadow: 'open', template: '<span><slot></slot></span>' }),
    expectOffered: false,
    expectDiagnostic: 'parse',
  },
];

/**
 * Build a scripted responder over these cases: it returns the canned `modelResponse` for whichever
 * case's `source` the prompt embeds (the prompt includes the source verbatim). Throws if none match
 * so a missing fixture is loud, not a silent empty completion.
 */
export function scriptedResponderFor(cases: readonly ModelCase[]): (prompt: string) => string {
  return (prompt: string) => {
    // Longest source first, so a case whose source is a substring of another can't shadow it.
    const match = [...cases].sort((a, b) => b.source.length - a.source.length).find((c) => prompt.includes(c.source));
    if (!match) throw new Error('scripted model: no fixture matches this prompt.');
    return match.modelResponse;
  };
}
