/**
 * Module-as-a-Service Consumer — backlog #081 phase 2a (native ESM over HTTP).
 *
 * The proof the playground can't give: a consumer with NO build step. This page does a native
 * `import()` of the MaaS endpoint — `/_maas/<name>.js?form=wc-class` — which returns a self-
 * contained ES module that `customElements.define`s the element on evaluation. After the import
 * resolves the tag simply works. No bundler, no transpile on this side; the server applied the
 * adapter transform. Also shows the raw served source (via `fetch`) and surfaces the
 * `X-MaaS-Lossy` / `X-MaaS-Diagnostic` headers so the lossy contract is visible over the wire.
 */
import { setPlaygroundReady } from '/demos/playground-harness';

const NAME = 'user-card';
const usageMarkup = '<user-card><span slot="title">Ada Lovelace</span><p>First programmer.</p></user-card>';

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const host = document.getElementById('app');
if (host) {
  const steps = el('ol', 'steps');
  const codePane = el('pre', 'code', '// served module source loads here…');
  const livePane = el('div', 'preview');
  const log = (msg: string, ok = true) => {
    const li = el('li', ok ? 'ok' : 'fail', msg);
    steps.append(li);
  };

  host.replaceChildren(
    el('div', 'pane-label', `GET /_maas/${NAME}.js?form=wc-class  →  native import()`),
    steps,
    el('div', 'pane-label', 'Served module source'),
    codePane,
    el('div', 'pane-label', 'Live element (defined purely by the import — no build step here)'),
    livePane,
  );

  const url = `/_maas/${NAME}.js?form=wc-class`;

  (async () => {
    try {
      // 1 — fetch the raw source just to display it + read the lossy contract headers.
      const resp = await fetch(url);
      log(`fetched ${url} → ${resp.status} ${resp.headers.get('content-type')}`);
      codePane.textContent = await resp.text();
      if (resp.headers.get('X-MaaS-Lossy'))
        log(`lossy: ${decodeURIComponent(resp.headers.get('X-MaaS-Diagnostic') || '')}`, false);

      // 2 — the real proof: native dynamic import. The module self-registers <user-card>.
      log(`customElements.get('${NAME}') before import → ${String(!!customElements.get(NAME))}`);
      await import(/* @vite-ignore */ url);
      await customElements.whenDefined(NAME);
      log(`imported module; customElements.get('${NAME}') → ${String(!!customElements.get(NAME))}`);

      // 3 — use it. Zero build on this page.
      livePane.innerHTML = usageMarkup;
      log('rendered <user-card> — works with no bundler/transpile on the consumer');

      // 4 — phase 2b: request the SAME component lowered to an older target. The server delegates to
      // esbuild; the result is still self-contained ESM (it would import identically — we only show
      // the source here to avoid a second customElements.define of the same tag).
      const loweredUrl = `/_maas/${NAME}.js?form=wc-class&target=es2015`;
      const lowered = await fetch(loweredUrl);
      const loweredPane = el('pre', 'code', await lowered.text());
      host.append(
        el('div', 'pane-label', `GET ${loweredUrl}  →  delegated to esbuild (phase 2b)`),
        loweredPane,
      );
      log('served the same component lowered to es2015 — private #fields / ??= compiled away by esbuild');

      // 5 — phase 2c: import a FUNCTIONAL-component form (a different tag, to avoid a redefine clash).
      // This module is NOT self-contained — it imports the jsx runtime via a bare specifier the page's
      // import map resolves. esbuild lowered the JSX at serve time; the consumer still does zero build.
      const FN_TAG = 'x-callout';
      const fnUrl = `/_maas/${FN_TAG}.js?form=functional`;
      const fnResp = await fetch(fnUrl);
      host.append(
        el('div', 'pane-label', `GET ${fnUrl}  →  functional component (transpiled, imports the runtime)`),
        el('pre', 'code', await fnResp.text()),
      );
      await import(/* @vite-ignore */ fnUrl);
      await customElements.whenDefined(FN_TAG);
      const fnLive = el('div', 'preview');
      fnLive.innerHTML = `<${FN_TAG}>Heads up — rendered by a functional component.</${FN_TAG}>`;
      host.append(el('div', 'pane-label', 'Live functional component (bare specifier resolved by the import map)'), fnLive);
      log(`imported functional <${FN_TAG}> — bare jsx-runtime specifier resolved via the page import map`);

      setPlaygroundReady(1);
    } catch (e) {
      log(`error: ${(e as Error).message}`, false);
    }
  })();
}
