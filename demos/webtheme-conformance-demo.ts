/**
 * Web Theme conformance demo (T4 of the #1294 relocation cascade, #1909).
 *
 * The webtheme runtime — the `resolveTokens` DTCG walk and `compileToCss` projection — is relocated to FUI
 * (#1907; WE holds zero executable, #1282) and its conformance runs through the **plateau-hosted conformance
 * iframe** (#1788 (b)): the plateau-origin runner driving the WE webtheme vector suite (#1908) against FUI's
 * binding. webtheme is a **non-verdict** standard — the observable is the resolved token map, judged by the
 * `deep-equal` matcher (#1816). This page embeds the plateau iframe cross-origin and reflects the conformance
 * result it posts back. The visible pass/fail is rendered at plateau-origin inside the iframe; the parent
 * shows the summary and flips the `setPlaygroundReady` flag the e2e smoke reads.
 */
import { setPlaygroundReady } from '/demos/playground-harness';

/** The result the plateau conformance iframe posts back once the suite has run (mirror of its own type). */
interface ConformanceEmbedResult {
  source: 'plateau-conformance';
  suite: string;
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  results: ReadonlyArray<{ id: string; pass: boolean; detail: string }>;
  error?: string;
}

// The conformance runner is the shared, multi-surface plateau tool (#1788 ratified (b)); the docs surface
// reaches it cross-origin. Plateau dev serves on :4000; override via `window.__PLATEAU_ORIGIN__` if hosted
// elsewhere.
const PLATEAU_ORIGIN =
  (window as unknown as { __PLATEAU_ORIGIN__?: string }).__PLATEAU_ORIGIN__ ?? 'http://localhost:4000';
const SUITE = 'webtheme';

const root = document.getElementById('play-root')!;
root.innerHTML = '';

const summary = document.createElement('p');
summary.className = 'conformance-summary';
summary.textContent = 'Running webtheme conformance via the plateau runner…';

const frame = document.createElement('iframe');
frame.className = 'conformance-iframe';
frame.title = 'webtheme conformance (plateau-hosted runner)';
frame.src = `${PLATEAU_ORIGIN}/conformance.html?suite=${SUITE}`;
frame.setAttribute('loading', 'eager');

root.append(summary, frame);

window.addEventListener('message', (event: MessageEvent) => {
  if (event.origin !== PLATEAU_ORIGIN) return; // only trust the plateau conformance origin
  const data = event.data as ConformanceEmbedResult;
  if (!data || data.source !== 'plateau-conformance' || data.suite !== SUITE) return;

  if (data.error) {
    summary.className = 'conformance-summary fail';
    summary.textContent = `✗ ${data.error}`;
    setPlaygroundReady(0);
    return;
  }
  summary.className = `conformance-summary ${data.ok ? 'pass' : 'fail'}`;
  summary.textContent = `${data.passed}/${data.total} webtheme conformance vectors passed (plateau-hosted runner, FUI engine)`;
  // The e2e smoke asserts the playground rendered green via the passing-vector count.
  setPlaygroundReady(data.passed);
});
