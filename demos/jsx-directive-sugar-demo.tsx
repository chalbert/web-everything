/**
 * JSX Directive Sugar Playground (#070) — the <For>/<Show>/<Resource> ⇄ <template is="…"> layer.
 *
 * Each card authors a tree with the prettier sugar components, renders it live through the JSX
 * renderer (the runtime directive components build the SAME DOM the canonical <template is> builds),
 * and checks three things against the shared fixtures:
 *
 *   - render    — sugar → DOM == the canonical HTML (DOM-equality, attribute-order-independent).
 *   - desugar   — desugar(sugar) == the canonical <template is> JSX.
 *   - round-trip — sugarize(desugar(sugar)) == the authored sugar.
 *
 * The example pairs live in the SHARED fixture module imported by the conformance suite too, so
 * these badges are backed by CI and can't drift. See reports/2026-06-03-jsx-adapter-feature-mapping.md
 * (rows 7–8). JSX is auto-injected by vite.config.mts.
 */

// Import the transforms from the directives SUBPATH, not the barrel: vite's jsxInject adds
// `import jsx from '/blocks/renderers/jsx'`, so importing named bindings from that same path would
// collide with the injected `jsx`. (Same reason jsx-adapter-demo imports htmlToJsx from a subpath.)
import { desugar, sugarize } from '/blocks/renderers/jsx/directives';
import {
  directiveSugarCases,
  type DirectiveSugarCase,
} from '/blocks/renderers/jsx/__fixtures__/directive-sugar-cases';
import { producedHtml, domEqual, setPlaygroundReady } from '/demos/playground-harness';

// The auto-injected factory, declared for editor/type tooling.
declare const jsx: typeof import('/blocks/renderers/jsx').default;

const norm = (s: string) => s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

let passCount = 0;

function card(ex: DirectiveSugarCase): Node {
  const live = ex.render();
  const html = producedHtml(live);
  const renders = domEqual(live, ex.html); // sugar → DOM == canonical
  const desugars = norm(desugar(ex.sugar)) === norm(ex.canonical);
  const roundTrips = norm(sugarize(desugar(ex.sugar))) === norm(ex.sugar);
  if (renders && desugars && roundTrips) passCount++;

  return (
    <section class="ex">
      <h2 class="ex-title">
        {ex.title}
        <span class={`badge ${renders ? 'pass' : 'fail'}`}>{renders ? '✓ renders' : '✗ drift'}</span>
        <span class={`badge ${desugars ? 'pass' : 'fail'}`}>{desugars ? '✓ desugars' : '✗ differs'}</span>
        <span class={`badge ${roundTrips ? 'pass' : 'fail'}`}>{roundTrips ? '✓ round-trips' : '✗ differs'}</span>
      </h2>
      {ex.note ? <p class="ex-note">{ex.note}</p> : null}
      <div class="ex-grid">
        <div class="pane">
          <div class="pane-label">Sugar (authored)</div>
          <pre class="code">{ex.sugar}</pre>
          <div class="pane-label" style="margin-top:0.75rem">desugar(sugar) → canonical &lt;template is&gt;</div>
          <pre class="code gen">{desugar(ex.sugar)}</pre>
        </div>
        <div class="pane">
          <div class="pane-label">Live render (via runtime &lt;For&gt;/&lt;Show&gt;/&lt;Resource&gt;)</div>
          <div class="preview">{live}</div>
        </div>
        <div class="pane">
          <div class="pane-label">Produced HTML {renders ? '= canonical' : '≠ canonical'}</div>
          <pre class="code">{html}</pre>
        </div>
      </div>
    </section>
  );
}

const host = document.getElementById('examples');
if (host) {
  const cards = directiveSugarCases.map(card);
  const allPass = passCount === directiveSugarCases.length;
  const summary = (
    <div class={`summary ${allPass ? 'pass' : 'fail'}`}>
      {passCount}/{directiveSugarCases.length} cases conformant — sugar renders to the canonical DOM,
      desugars to <code>&lt;template is&gt;</code>, and round-trips back via <code>sugarize</code>.
    </div>
  );
  host.replaceChildren(summary, ...cards);
}

setPlaygroundReady(passCount);
