/**
 * Code Upgrader Playground — backlog #094, MVP walking skeleton.
 *
 * The inverse of the Module-as-a-Service demo: instead of serving one authored component in many
 * forms, this takes EXISTING legacy code and lifts it ONTO the standard. Each card runs the shared
 * upgrader engine on a fixture and shows the whole pipeline:
 *
 *   legacy source  →  neutral IR  →  generated <component>  →  verify badge  →  live element + form toggle
 *
 * The same engine + fixtures the unit suite imports, so the badges here and CI agree (no drift). The
 * generated `<component>` is fed straight into the existing MaaS `serve()` — proving the upgrader is a
 * front door onto the SAME core, not a parallel generator. Native APIs only; no bootstrap.
 */
import { setPlaygroundReady } from '/demos/playground-harness';
import { CustomAnalyzerRegistry, upgrade, type UpgradeResult } from '/blocks/renderers/upgrader/upgraderEngine';
import { registerReferenceAnalyzers } from '/blocks/renderers/upgrader/analyzers/legacyWebComponent';
import { registerModelAnalyzer, createScriptedClient } from '/blocks/renderers/upgrader/analyzers/modelComponent';
import { serve, FORMS, type ServeForm } from '/blocks/renderers/module-service/moduleService';
import { parseDefinition, defineFromDefinition } from '/blocks/renderers/component/declarativeComponent';
import { upgraderCases, type UpgraderCase } from '/blocks/renderers/upgrader/__fixtures__/upgrader-cases';
import { modelCases, knownModelIntents, scriptedResponderFor, type ModelCase } from '/blocks/renderers/upgrader/__fixtures__/model-cases';

// The analyzer registry is the swap point: here we inject the reference (no-key) provider. A BYO-AI
// provider would be a sibling `registry.register(anthropicAnalyzer)` — nothing else changes.
const registry = new CustomAnalyzerRegistry();
registerReferenceAnalyzers(registry);

// Intent ids the standard knows, for the verify gate's conformance check on the reference path (#189).
// In a real run this comes from intents.json; here we list the ones the reference analyzer can infer
// (selection, motion, disclosure). The check is a no-op for cards whose IR carries no inferred intents,
// so this only lights up on the intent-inference fixtures.
const knownReferenceIntents = new Set(['selection', 'motion', 'disclosure']);

// The AI registry adds a REAL model provider AHEAD of the reference one (backlog #188): messier input
// the heuristic rejects escalates to the model, clean input still falls through to the reference. In
// the browser there's no key, so we drive a deterministic SCRIPTED client — a real run swaps in
// `createAnthropicClient({ apiKey })` (BYO key, Node/CI-side), nothing else changes. The verify gate
// is identical, so hallucinated structure is rejected here exactly as it would be for a live model.
const knownIntents = new Set<string>(knownModelIntents);
const aiRegistry = new CustomAnalyzerRegistry();
registerModelAnalyzer(aiRegistry, createScriptedClient(scriptedResponderFor(modelCases)), { knownIntents: knownModelIntents });
registerReferenceAnalyzers(aiRegistry);

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function pane(label: string, codeText: string, lang?: string): HTMLElement {
  const p = el('div', 'pane');
  p.append(el('div', 'pane-label', label));
  const code = el('pre', 'code', codeText);
  if (lang) code.dataset.lang = lang;
  p.append(code);
  return p;
}

let liveCount = 0;

/** Render the verify badge + the per-check breakdown so the gate is transparent, not a black box. */
function verifyPane(result: UpgradeResult): HTMLElement {
  const p = el('div', 'pane');
  p.append(el('div', 'pane-label', 'Verify gate'));
  const badge = el(
    'span',
    `badge ${result.offered ? 'pass' : 'fail'}`,
    result.offered ? '✓ offered (verified)' : '✗ not offered',
  );
  p.append(badge);
  const list = el('ul', 'checks');
  for (const c of result.verify.checks) {
    list.append(el('li', c.ok ? 'ok' : 'bad', `${c.ok ? '✓' : '✗'} ${c.id} — ${c.detail}`));
  }
  if (!result.verify.checks.length) list.append(el('li', 'bad', '✗ no output to verify'));
  p.append(list);
  if (result.diagnostics.length) {
    const diag = el('div', 'diag', result.diagnostics.map((d) => `• ${d}`).join('\n'));
    p.append(diag);
  }
  return p;
}

/** When the upgrade is offered, show it running + a form toggle reusing MaaS `serve()`. */
function livePane(generated: string): HTMLElement {
  const p = el('div', 'pane');
  p.append(el('div', 'pane-label', 'Upgraded output — served in any form (via MaaS serve())'));

  const toggle = el('div', 'forms');
  const codeOut = el('pre', 'code', '');
  let current: ServeForm = 'declarative';
  const refresh = () => {
    try {
      const r = serve(generated, { form: current });
      codeOut.textContent = r.code;
      codeOut.dataset.lang = r.language;
    } catch (e) {
      codeOut.textContent = `// error: ${(e as Error).message}`;
    }
    for (const b of toggle.querySelectorAll('button'))
      b.classList.toggle('active', (b as HTMLButtonElement).dataset.form === current);
  };
  for (const f of FORMS) {
    const b = el('button', 'form-btn', f.label) as HTMLButtonElement;
    b.dataset.form = f.id;
    b.title = f.blurb;
    b.addEventListener('click', () => { current = f.id; refresh(); });
    toggle.append(b);
  }
  p.append(toggle, codeOut);

  // Register + render the upgraded element so you can see it actually run.
  p.append(el('div', 'pane-label', 'Live element'));
  const preview = el('div', 'preview');
  p.append(preview);
  try {
    const def = parseDefinition(generated);
    const tag = `${def.name}-up${++liveCount}`;
    defineFromDefinition(def, tag);
    preview.innerHTML = `<${tag}></${tag}>`;
  } catch (e) {
    preview.textContent = `parse error: ${(e as Error).message}`;
  }
  refresh();
  return p;
}

async function buildCard(c: UpgraderCase): Promise<{ node: HTMLElement; offered: boolean }> {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(c.title + ' '));
  section.append(title);
  if (c.note) section.append(el('p', 'ex-note', c.note));

  const grid = el('div', 'ex-grid');
  section.append(grid);

  const result = await upgrade({ code: c.source }, { registry, knownIntents: knownReferenceIntents });

  // Badge in the title reflects whether the verify gate matched the fixture's expectation.
  const matchesExpectation = result.offered === c.expectOffered;
  const badge = el(
    'span',
    `badge ${matchesExpectation ? 'pass' : 'fail'}`,
    matchesExpectation ? (result.offered ? '✓ upgraded' : '✓ correctly rejected') : '✗ unexpected',
  );
  title.append(badge);

  grid.append(pane('Legacy source (input)', c.source, 'javascript'));
  grid.append(pane('Neutral structure (IR)', result.ir ? JSON.stringify(result.ir, null, 2) : '— no IR (analyzer declined)', 'json'));
  grid.append(pane('Generated <component>', result.generated ?? '— nothing offered', 'html'));
  grid.append(verifyPane(result));
  if (result.offered && result.generated) grid.append(livePane(result.generated));

  return { node: section, offered: matchesExpectation };
}

// ── Model-provider cards (backlog #188) ─────────────────────────────────────────
//
// Same pipeline, with an extra "Model response" pane and an explicit `via {analyzerId}` label so a
// model failure (the analyzer threw on bad output) reads distinctly from a reference subset rejection.

async function buildModelCard(c: ModelCase): Promise<{ node: HTMLElement; offered: boolean }> {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(c.title + ' '));
  section.append(title);
  if (c.note) section.append(el('p', 'ex-note', c.note));

  const grid = el('div', 'ex-grid');
  section.append(grid);

  const result = await upgrade({ code: c.source }, { registry: aiRegistry, knownIntents });

  const matchesExpectation = result.offered === c.expectOffered;
  const badge = el(
    'span',
    `badge ${matchesExpectation ? 'pass' : 'fail'}`,
    matchesExpectation ? (result.offered ? '✓ upgraded' : '✓ correctly rejected') : '✗ unexpected',
  );
  title.append(badge);
  title.append(el('span', 'pane-label', ` via ${result.analyzerId ?? 'no provider'}`));

  grid.append(pane('Legacy source (input)', c.source, 'javascript'));
  grid.append(pane('Model response (raw)', c.modelResponse, 'json'));
  grid.append(pane('Neutral structure (IR)', result.ir ? JSON.stringify(result.ir, null, 2) : '— no IR (model output rejected)', 'json'));
  grid.append(pane('Generated <component>', result.generated ?? '— nothing offered', 'html'));
  grid.append(verifyPane(result));
  if (result.offered && result.generated) grid.append(livePane(result.generated));

  return { node: section, offered: matchesExpectation };
}

// ── Editable sandbox — paste your own legacy component ──────────────────────────

function buildSandbox(): HTMLElement {
  const wrap = el('section', 'sandbox');
  const head = el('div', 'sandbox-head');
  head.append(el('h2', undefined, 'Upgrade your own'));
  const runBtn = el('button', 'sandbox-run', 'Upgrade ▶') as HTMLButtonElement;
  head.append(runBtn);
  wrap.append(head);

  const grid = el('div', 'sandbox-grid');
  const input = document.createElement('textarea');
  input.spellcheck = false;
  input.value =
    `class HelloBox extends HTMLElement {\n` +
    `  connectedCallback() {\n` +
    `    this.attachShadow({ mode: 'open' });\n` +
    "    this.shadowRoot.innerHTML = `<style>:host{display:block;padding:.5rem}</style>👋 <slot>world</slot>`;\n" +
    `  }\n` +
    `}\n` +
    `customElements.define('hello-box', HelloBox);`;
  grid.append(input);

  const out = el('div', 'sandbox-out');
  grid.append(out);
  wrap.append(grid);

  const run = async () => {
    out.replaceChildren(el('div', 'pane-label', 'Working…'));
    const result = await upgrade({ code: input.value }, { registry });
    const panes: HTMLElement[] = [
      pane('Neutral structure (IR)', result.ir ? JSON.stringify(result.ir, null, 2) : '— no IR', 'json'),
      pane('Generated <component>', result.generated ?? '— nothing offered', 'html'),
      verifyPane(result),
    ];
    if (result.offered && result.generated) panes.push(livePane(result.generated));
    out.replaceChildren(...panes);
  };
  runBtn.addEventListener('click', run);
  queueMicrotask(run);
  return wrap;
}

// ── Mount ───────────────────────────────────────────────────────────────────────

function sectionHeading(title: string, blurb: string): HTMLElement {
  const wrap = el('div', 'section-head');
  wrap.append(el('h2', undefined, title));
  wrap.append(el('p', 'ex-note', blurb));
  return wrap;
}

const host = document.getElementById('examples');
if (host) {
  const [refBuilt, modelBuilt] = await Promise.all([
    Promise.all(upgraderCases.map(buildCard)),
    Promise.all(modelCases.map(buildModelCard)),
  ]);
  const built = [...refBuilt, ...modelBuilt];
  const passCount = built.filter((b) => b.offered).length;
  const summary = el(
    'div',
    `summary ${passCount === built.length ? 'pass' : 'fail'}`,
    `${passCount}/${built.length} cases matched their expected verify outcome`,
  );
  host.replaceChildren(
    summary,
    buildSandbox(),
    sectionHeading('Reference analyzer (deterministic, no key)', 'The MVP source path: vanilla web components lifted by the heuristic provider.'),
    ...refBuilt.map((b) => b.node),
    sectionHeading('Model provider (BYO key — scripted here)', 'The messier input the heuristic rejects, escalated to a model. Hallucinated structure is caught by the same verify gate and never offered.'),
    ...modelBuilt.map((b) => b.node),
  );
  setPlaygroundReady(passCount);
}
