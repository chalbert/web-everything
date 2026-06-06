/**
 * Component Adapter Playground — test the declarative `<component>` → class transform.
 *
 * The intended implementation of the `<component>` standard is a deterministic, build-time,
 * AST-based transform (the `declarative-component` adapter) that lowers each definition to a
 * class-based custom element. This playground runs the *runtime twin* of that transform in the
 * browser so it can be exercised live: for each definition it
 *   1. shows the authored declarative source,
 *   2. emits the generated class source (what the build-time adapter would write),
 *   3. registers the element and renders a live instance,
 *   4. CHECKS that the rendered shadow/light tree equals the authored template (pass/fail badge).
 *
 * The class string in (2) and the runtime registration in (3) are generated from one parsed
 * definition, so they are lockstep by construction. See reports/2026-06-03-declarative-component-element.md
 * and /blocks/component/. Native APIs only — no bootstrap, no JSX.
 */

import { htmlEqual, setPlaygroundReady } from '/demos/playground-harness';
import {
  type ComponentDef,
  parseDefinition,
  generateClassSource,
  defineFromDefinition,
} from '/blocks/renderers/component/declarativeComponent';
import { componentCases, type ComponentCase } from '/blocks/renderers/component/__fixtures__/component-cases';

// The lowering (parse → class → register) lives in the SHARED module, imported by the conformance
// suite too, so the badges below and CI exercise the exact same transform. The example definitions
// come from the shared component-fixtures module (the #A-style anti-drift split).
type Example = ComponentCase;

// ── Conformance: does the rendered tree equal the authored template? ──────────

/** Compare the element's rendered template region against the authored template HTML. */
function conformance(el: Element, def: ComponentDef): { ok: boolean; rendered: string; opaque?: boolean } {
  let rendered = '';
  if (def.shadow === 'open') rendered = el.shadowRoot ? el.shadowRoot.innerHTML : '';
  else if (def.shadow === 'none') rendered = el.innerHTML;
  // closed: the root is not exposed (el.shadowRoot is null), so the tree can't be read.
  else return { ok: true, rendered: '(closed shadow — not introspectable)', opaque: true };
  return { ok: htmlEqual(rendered, def.templateHTML), rendered };
}

// ── Examples (shared fixtures) ─────────────────────────────────────────────────

const examples: Example[] = componentCases;

// ── Rendering ───────────────────────────────────────────────────────────────

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

let passCount = 0;

function buildCard(ex: Example): { node: HTMLElement; run: () => void } {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(ex.title + ' '));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);
  if (ex.note) section.append(el('p', 'ex-note', ex.note));

  const grid = el('div', 'ex-grid');
  section.append(grid);

  let def: ComponentDef;
  let classSrc = '';
  let error = '';
  try {
    def = parseDefinition(ex.def);
    classSrc = generateClassSource(def);
  } catch (e) {
    error = (e as Error).message;
  }

  grid.append(pane('Declarative source', ex.def));
  grid.append(pane('Generated class (adapter output)', error ? `// error: ${error}` : classSrc));

  const livePane = el('div', 'pane');
  livePane.append(el('div', 'pane-label', 'Live element'));
  const preview = el('div', 'preview');
  livePane.append(preview);
  grid.append(livePane);

  // run() executes after the card is in the document, so custom-element upgrade fires.
  const run = () => {
    if (error) {
      badge.className = 'badge fail';
      badge.textContent = '✗ parse error';
      return;
    }
    defineFromDefinition(def, def.name);
    preview.innerHTML = ex.usage; // in-DOM → upgrade + connectedCallback run synchronously
    const instance = preview.firstElementChild;
    if (!instance) {
      badge.className = 'badge fail';
      badge.textContent = '✗ no instance';
      return;
    }
    const { ok, opaque } = conformance(instance, def);
    if (opaque) {
      badge.className = 'badge info';
      badge.textContent = '✓ closed (opaque)';
      passCount++;
      return;
    }
    badge.className = `badge ${ok ? 'pass' : 'fail'}`;
    badge.textContent = ok ? '✓ conformant' : '✗ drift';
    if (ok) passCount++;
  };

  return { node: section, run };
}

// ── Editable sandbox ──────────────────────────────────────────────────────────

let sandboxCounter = 0;

function buildSandbox(): HTMLElement {
  const wrap = el('section', 'sandbox');
  const head = el('div', 'sandbox-head');
  head.append(el('h2', undefined, 'Try your own'));
  const runBtn = el('button', 'sandbox-run', 'Run ▶') as HTMLButtonElement;
  head.append(runBtn);
  wrap.append(head);

  const grid = el('div', 'sandbox-grid');
  const input = document.createElement('textarea');
  input.spellcheck = false;
  input.value =
    `<component name="hello-box" shadow="open">\n` +
    `  <style>:host { display:block; padding:.5rem; border:1px solid #e5e7eb; border-radius:.375rem }</style>\n` +
    `  👋 <slot>world</slot>\n` +
    `</component>\n\n` +
    `<!-- usage (instantiates the element above) -->\n` +
    `<hello-box>there</hello-box>`;
  grid.append(input);

  const classPaneWrap = el('div', 'pane');
  classPaneWrap.append(el('div', 'pane-label', 'Generated class'));
  const classOut = el('pre', 'code', '');
  classPaneWrap.append(classOut);
  grid.append(classPaneWrap);

  const livePaneWrap = el('div', 'pane');
  livePaneWrap.append(el('div', 'pane-label', 'Live element'));
  const liveOut = el('div', 'preview');
  livePaneWrap.append(liveOut);
  grid.append(livePaneWrap);

  wrap.append(grid);

  const run = () => {
    const src = input.value;
    // Split definition (the <component> block) from the usage that follows it.
    const close = src.indexOf('</component>');
    const defSrc = close === -1 ? src : src.slice(0, close + '</component>'.length);
    const usage = close === -1 ? '' : src.slice(close + '</component>'.length).replace(/<!--[\s\S]*?-->/g, '').trim();
    try {
      const def = parseDefinition(defSrc);
      classOut.textContent = generateClassSource(def);
      // Uniquify the tag so repeated runs (with edits) don't hit "already defined".
      const tag = `${def.name}-r${++sandboxCounter}`;
      defineFromDefinition(def, tag);
      const instanceMarkup = (usage || `<${def.name}></${def.name}>`)
        .replaceAll(`<${def.name}`, `<${tag}`)
        .replaceAll(`</${def.name}>`, `</${tag}>`);
      liveOut.innerHTML = instanceMarkup;
    } catch (e) {
      classOut.textContent = `// error: ${(e as Error).message}`;
      liveOut.innerHTML = '';
    }
  };
  runBtn.addEventListener('click', run);
  // Defer first run until the sandbox is in the document.
  queueMicrotask(run);
  return wrap;
}

// ── Mount ─────────────────────────────────────────────────────────────────────

const host = document.getElementById('examples');
if (host) {
  const built = examples.map(buildCard);
  const summary = el('div', 'summary', '');
  host.replaceChildren(summary, buildSandbox(), ...built.map((b) => b.node));
  // Now the cards are in the document — upgrade + check.
  built.forEach((b) => b.run());
  summary.className = `summary ${passCount === examples.length ? 'pass' : 'fail'}`;
  summary.textContent = `${passCount}/${examples.length} examples conformant (rendered tree equals the authored template)`;
}

setPlaygroundReady(passCount);
