/**
 * Module-as-a-Service Playground — backlog #081, v1 walking skeleton.
 *
 * Demonstrates the ONE objective of v1: a single authored component served in any *form* via a
 * single request param. Each card takes one `<component>` definition (from the SHARED component-
 * cases fixtures — same source the conformance suite and the Component Adapter demo use) and a
 * form toggle. Switching the toggle calls `serve(def, { form })` and shows the returned code; the
 * live pane registers + renders the element so you can see the served WC form actually run.
 *
 * The resolver owns no transform logic — it dispatches to the shared `declarativeComponent` /
 * `htmlToJsx` modules — so the form shown here is provably the form the build-time adapters emit.
 * Native APIs only — no bootstrap, no framework. The "service" here is in-process (the in-repo
 * stub standing in for the eventual ESM-over-HTTP delivery; that is #081 phase 2).
 */
import { setPlaygroundReady } from '/demos/playground-harness';
import { serve, FORMS, type ServeForm } from '/blocks/renderers/module-service/moduleService';
import { parseDefinition, defineFromDefinition } from '/blocks/renderers/component/declarativeComponent';
import { componentCases, type ComponentCase } from '/blocks/renderers/component/__fixtures__/component-cases';

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

let liveCount = 0;

function buildCard(ex: ComponentCase): HTMLElement {
  const section = el('section', 'ex');
  section.append(el('h2', 'ex-title', ex.title));
  if (ex.note) section.append(el('p', 'ex-note', ex.note));

  // Form toggle — the single request param. One authored def, N served forms.
  const toggle = el('div', 'forms');
  const codeOut = el('pre', 'code', '');
  const diag = el('div', 'diag');
  let current: ServeForm = 'declarative';

  const refresh = () => {
    try {
      const r = serve(ex.def, { form: current });
      codeOut.textContent = r.code;
      codeOut.dataset.lang = r.language;
      diag.textContent = r.lossy ? `⚠ ${r.diagnostics.join(' ')}` : '';
      diag.className = `diag${r.lossy ? ' lossy' : ''}`;
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
  section.append(toggle, codeOut, diag);

  // Live pane — register the served WC form and render an instance (proves the form runs, not just prints).
  const livePane = el('div', 'pane');
  livePane.append(el('div', 'pane-label', 'Live element (served WC form)'));
  const preview = el('div', 'preview');
  livePane.append(preview);
  section.append(livePane);

  try {
    const def = parseDefinition(ex.def);
    const tag = `${def.name}-maas${++liveCount}`;
    defineFromDefinition(def, tag);
    preview.innerHTML = ex.usage
      .replaceAll(`<${def.name}`, `<${tag}`)
      .replaceAll(`</${def.name}>`, `</${tag}>`);
  } catch (e) {
    preview.textContent = `parse error: ${(e as Error).message}`;
  }

  refresh();
  return section;
}

const host = document.getElementById('examples');
if (host) {
  host.replaceChildren(...componentCases.map(buildCard));
  // No pass/fail conformance in v1 — the playground is "ready" once all cards rendered.
  setPlaygroundReady(componentCases.length);
}
