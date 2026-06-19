/**
 * Web Identity conformance demo (#1062, slice C of #1022) — the runnable proof of the
 * `CustomCredentialProvider` contract (#1060) in a real browser.
 *
 * The contract is type-only (`we:identity/contract.ts`); the real passkey / FedCM / digital-credential
 * providers (RP/IdP round-trips) are impl and live in FUI. So this demo supplies its **own** in-demo
 * provider — capability-gated stubs, honest for a browser demo with no RP — to prove the contract is
 * realizable: `supports(family, member)` gates what a provider serves, and `acquire(request)` resolves to a
 * `CredentialResult` (`fulfilled` / `declined` / `unavailable`). The conformance section asserts each
 * contract invariant live; `setPlaygroundReady` reports the pass count the e2e smoke reads.
 */
import type {
  CustomCredentialProvider,
  CredentialFamily,
  CredentialMember,
  CredentialRequest,
  CredentialResult,
} from '/identity/contract.ts';
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

/**
 * An in-demo credential provider: serves `passkey` (request + enroll) and `federated` (request-only),
 * mirroring the platform capability split. `acquire` returns `unavailable` for a family it doesn't serve
 * (never a silent substitute), `declined` under silent mediation (no UI), else `fulfilled`.
 */
class DemoCredentialProvider implements CustomCredentialProvider {
  readonly families: CredentialFamily[] = ['passkey', 'federated'];

  supports(family: CredentialFamily, member: CredentialMember): boolean {
    if (!this.families.includes(family)) return false;
    // FedCM/digital are request-only; passkey also enrolls.
    if (member === 'credential-enrollment') return family === 'passkey';
    return true;
  }

  async acquire(request: CredentialRequest): Promise<CredentialResult> {
    const family = request.credentials.find((f) => this.supports(f, request.member));
    if (!family) {
      return { family: request.credentials[0], credential: null, status: 'unavailable' };
    }
    // Silent mediation must not prompt — with no pre-existing credential here, that is a decline.
    if (request.mediation === 'silent') {
      return { family, credential: null, status: 'declined' };
    }
    return { family, credential: null, status: 'fulfilled' };
  }

  subscribe(onInvalidate: () => void): () => void {
    // No real session here; return the revocable cleanup the contract requires.
    const handle = { onInvalidate };
    return () => {
      handle.onInvalidate = () => {};
    };
  }
}

const provider = new DemoCredentialProvider();
const request = (over: Partial<CredentialRequest> = {}): CredentialRequest => ({
  member: 'credential-request',
  credentials: ['passkey'],
  ...over,
});

interface Check {
  title: string;
  run: () => Promise<boolean> | boolean;
}

const CHECKS: Check[] = [
  {
    title: 'supports() gates by family + member (passkey enrolls; federated is request-only)',
    run: () =>
      provider.supports('passkey', 'credential-enrollment') === true
      && provider.supports('federated', 'credential-enrollment') === false
      && provider.supports('digital', 'credential-request') === false,
  },
  {
    title: 'acquire() fulfills a supported family',
    run: async () => (await provider.acquire(request({ credentials: ['passkey'] }))).status === 'fulfilled',
  },
  {
    title: 'acquire() reports unavailable for an unsupported family (never a silent substitute)',
    run: async () => (await provider.acquire(request({ credentials: ['digital'] }))).status === 'unavailable',
  },
  {
    title: 'silent mediation declines rather than prompting',
    run: async () =>
      (await provider.acquire(request({ credentials: ['passkey'], mediation: 'silent' }))).status === 'declined',
  },
  {
    title: 'the result names the family it resolved against',
    run: async () => (await provider.acquire(request({ credentials: ['federated'] }))).family === 'federated',
  },
  {
    title: 'subscribe() returns a revocable cleanup (the contract’s teardown)',
    run: () => {
      let invalidated = false;
      const cleanup = provider.subscribe(() => (invalidated = true));
      const ok = typeof cleanup === 'function';
      cleanup();
      return ok && invalidated === false;
    },
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
    const card = el('div', { class: 'play-card wid-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'wid-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} webidentity contract invariants hold`;
  return pass;
}

async function main(): Promise<void> {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  const conformance = el('section', { class: 'wid-card' });
  conformance.append(el('h2', {}, 'Runtime conformance — CustomCredentialProvider contract'));
  const passCount = await runConformance(conformance);
  root.append(conformance);

  setPlaygroundReady(passCount);
}

void main();
