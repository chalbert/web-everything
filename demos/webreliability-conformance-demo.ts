/**
 * Web Reliability conformance demo (#1053, slice C of #1019) — the runnable proof of the
 * `CustomRecoveryHandler` contract (#1051) in a real browser.
 *
 * The contract is type-only (`we:reliability/contract.ts`); the HTTP-retry / circuit-breaker / offline-queue
 * handlers and the `customRecovery` registry are impl and live in FUI. So this demo supplies its **own**
 * in-demo recovery handler — a small offline-retry / resumable-transfer policy — to prove the contract is
 * realizable: a handler inspects the error + `RecoveryContext` and either declines (`null`, next handler
 * tried) or owns the recovery (a `RecoveryResult` with an `outcome`). The conformance section asserts each
 * contract invariant live; `setPlaygroundReady` reports the pass count the e2e smoke reads.
 */
import type {
  CustomRecoveryHandler,
  RecoveryContext,
  RecoveryError,
  RecoveryResult,
} from '/reliability/contract.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

const MAX_ATTEMPTS = 3;

/**
 * An in-demo recovery handler conforming to the contract: it declines errors it doesn't recognize
 * (`null`), retries a transient error with exponential backoff, queues an offline error for replay on
 * reconnection, and aborts once the attempt cap is reached.
 */
class DemoRecoveryHandler implements CustomRecoveryHandler {
  readonly key = 'demo-offline-retry';

  async tryRecover(error: RecoveryError, context: RecoveryContext): Promise<RecoveryResult | null> {
    const kind = (error as { kind?: string } | null)?.kind;
    if (kind !== 'transient' && kind !== 'offline') return null; // decline — not ours
    if (context.attempt >= MAX_ATTEMPTS) return { outcome: 'abort', reason: 'attempt cap reached' };
    if (kind === 'offline') return { outcome: 'queued', delay: 1000, reason: 'offline; replay on reconnect' };
    return { outcome: 'retry', delay: 2 ** context.attempt * 100, reason: 'transient; backing off' };
  }
}

const handler = new DemoRecoveryHandler();
const ctx = (attempt: number, operationId = 'op-1'): RecoveryContext => ({
  error: undefined,
  attempt,
  operationId,
});

interface Check {
  title: string;
  run: () => Promise<boolean> | boolean;
}

const CHECKS: Check[] = [
  {
    title: 'declines an unrecognized error (returns null — the next handler is tried)',
    run: async () => (await handler.tryRecover({ kind: 'fatal' }, ctx(0))) === null,
  },
  {
    title: 'retries a transient error with a backoff delay',
    run: async () => {
      const r = await handler.tryRecover({ kind: 'transient' }, ctx(0));
      return r?.outcome === 'retry' && typeof r.delay === 'number' && r.delay > 0;
    },
  },
  {
    title: 'queues an offline error for replay on reconnection',
    run: async () => (await handler.tryRecover({ kind: 'offline' }, ctx(0)))?.outcome === 'queued',
  },
  {
    title: 'aborts once the attempt cap is reached',
    run: async () => (await handler.tryRecover({ kind: 'transient' }, ctx(MAX_ATTEMPTS)))?.outcome === 'abort',
  },
  {
    title: 'backoff grows with the attempt count (exponential)',
    run: async () => {
      const a = await handler.tryRecover({ kind: 'transient' }, ctx(0));
      const b = await handler.tryRecover({ kind: 'transient' }, ctx(2));
      return (b?.delay ?? 0) > (a?.delay ?? 0);
    },
  },
  {
    title: 'the handler exposes a stable priority key',
    run: () => typeof handler.key === 'string' && handler.key.length > 0,
  },
];

async function runConformance(host: HTMLElement): Promise<number> {
  const summary = el('div', { class: 'summary' });
  host.append(summary);
  let pass = 0;
  for (const check of CHECKS) {
    let ok = false;
    try {
      ok = await check.run();
    } catch {
      ok = false;
    }
    if (ok) pass += 1;
    const card = el('div', { class: 'play-card wr-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'wr-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} webreliability contract invariants hold`;
  return pass;
}

async function main(): Promise<void> {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  const conformance = el('section', { class: 'wr-card' });
  conformance.append(el('h2', {}, 'Runtime conformance — CustomRecoveryHandler contract'));
  const passCount = await runConformance(conformance);
  root.append(conformance);

  setPlaygroundReady(passCount);
}

void main();
