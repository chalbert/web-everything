/**
 * Mockup-to-Standard Playground — backlog #086.
 *
 * The design-to-code front door on the #094 upgrader pipeline. Instead of lifting EXISTING CODE, each
 * card lifts a UI **mockup** (static image, Figma frame, interactive prototype) through the SAME shared
 * engine and the SAME verify gate:
 *
 *   mockup  →  neutral structure (IR)  →  generated <component>  →  verify badge  →  live element
 *
 * Two #086 invariants made visible:
 *   - **AI-tool independence:** mockup analysis is a swappable `CustomVisionProvider` behind the registry.
 *     Here the deterministic, keyless **reference** provider stands in until the Plateau vision service
 *     (#475) ships — a BYO `createPlateauVisionProvider({ endpoint })` drops into the same registry with
 *     no engine change.
 *   - **Same core, no parallel generator:** the generated `<component>` is the exact declarative form the
 *     /adapters/ + MaaS demos consume; it mounts as a real custom element below.
 *
 * The same engine + provider the unit suite imports, so the badges here and CI agree (no drift). Native
 * APIs only; no bootstrap.
 */
import { setPlaygroundReady } from '/demos/playground-harness';
import { CustomAnalyzerRegistry, upgrade, type UpgradeResult, type MockupSource } from '/blocks/renderers/upgrader/upgraderEngine';
import { registerMockupAnalyzer, createReferenceVisionProvider } from '/blocks/renderers/upgrader/analyzers/mockupAnalyzer';
import { parseDefinition, defineFromDefinition } from '/blocks/renderers/component/declarativeComponent';

// The intents the standard knows, offered to the verify gate's conformance check. The reference provider
// references ONLY these; an unknown intent would fail the gate and never be offered.
const knownIntents = ['disclosure', 'selection', 'motion'];
const knownIntentSet = new Set(knownIntents);

// The swap point: inject the keyless reference vision provider. A real run swaps in
// `createPlateauVisionProvider({ endpoint })` (no-leakage Plateau-service client) — nothing else changes.
const registry = new CustomAnalyzerRegistry();
registerMockupAnalyzer(registry, createReferenceVisionProvider(), { knownIntents });

interface MockupCase {
  title: string;
  mockup: MockupSource;
}

const cases: MockupCase[] = [
  {
    title: 'Static image → disclosure panel',
    mockup: { kind: 'image', ref: 'mock://faq-section.png', description: 'FAQ section with an expand/collapse toggle for each answer' },
  },
  {
    title: 'Figma frame → selection list',
    mockup: { kind: 'figma', ref: 'figma://file/abc/node/12:3', description: 'Country picker — choose an option from a listbox' },
  },
  {
    title: 'Interactive prototype → animated card',
    mockup: { kind: 'prototype', ref: 'https://proto.example/card', description: 'Hero card with a motion transition on reveal' },
  },
  {
    title: 'Static image → plain content (no intent inferred)',
    mockup: { kind: 'image', ref: 'mock://about.png', description: 'A plain about-us content block' },
  },
];

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function pane(label: string, codeText: string): HTMLElement {
  const p = el('div', 'pane');
  p.append(el('div', 'pane-label', label));
  p.append(el('pre', 'code', codeText));
  return p;
}

function verifyPane(result: UpgradeResult): HTMLElement {
  const p = el('div', 'pane');
  p.append(el('div', 'pane-label', 'Verify gate'));
  const badge = el('div', `verify-badge ${result.offered ? 'ok' : 'fail'}`, result.offered ? '✓ offered' : '✗ not offered');
  p.append(badge);
  const list = el('ul', 'verify-checks');
  for (const c of result.verify.checks) {
    list.append(el('li', c.ok ? 'check-ok' : 'check-fail', `${c.ok ? '✓' : '✗'} ${c.id} — ${c.detail}`));
  }
  p.append(list);
  return p;
}

let liveCount = 0;
let passCount = 0;

async function renderCase(c: MockupCase): Promise<void> {
  const card = el('section', 'card');
  card.append(el('h2', 'card-title', c.title));

  const result = await upgrade({ mockup: c.mockup }, { registry, knownIntents: knownIntentSet });

  const grid = el('div', 'panes');
  grid.append(pane('Mockup input', `kind: ${c.mockup.kind}\nref:  ${c.mockup.ref}\n\n${c.mockup.description ?? ''}`));
  grid.append(pane('Neutral IR (ComponentIR)', JSON.stringify(result.ir, null, 2)));
  grid.append(pane('Generated <component>', result.generated ?? '(none)'));
  grid.append(verifyPane(result));
  card.append(grid);

  // Mount the generated component as a REAL custom element — proof it feeds the same core.
  if (result.offered && result.generated) {
    const def = parseDefinition(result.generated);
    const tag = `${def.name}-m${liveCount++}`; // unique tag per card (custom elements can't redefine)
    defineFromDefinition(def, tag);
    const live = el('div', 'pane');
    live.append(el('div', 'pane-label', 'Live element'));
    live.append(document.createElement(tag));
    card.append(live);
    passCount++;
  }

  if (result.diagnostics.length) {
    card.append(pane('Diagnostics', result.diagnostics.join('\n')));
  }

  document.getElementById('cards')?.append(card);
}

async function main(): Promise<void> {
  for (const c of cases) await renderCase(c);
  setPlaygroundReady(passCount);
}

void main();
