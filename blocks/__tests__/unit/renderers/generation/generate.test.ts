/**
 * @file blocks/__tests__/unit/renderers/generation/generate.test.ts
 * @description Tests for the deterministic MaaS generation adapter (backlog #547, slice 1 of #507).
 *
 * Proves the three properties #463 fork a + #547 require:
 *   1. The engine ENFORCES determinism — a non-deterministic backend throws; the JS backend is byte-stable.
 *   2. The JS golden is the regenerated JS reference origin, locked byte-for-byte (the drift gate).
 *   3. The generated origin is FAITHFUL: its neutral core re-exposes the IR's contract, and the on-disk
 *      shell, wired to injected seams, actually serves the #088 pin-ladder responses — validating the
 *      backend interface against the already-conformance-covered JS target before #548 (.NET).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SERVE_PATH } from '../../../../renderers/module-service/servePathIR';
import {
  generateOrigin,
  javascriptBackend,
  NonDeterministicBackendError,
  type LanguageBackend,
} from '../../../../renderers/module-service/generation';

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(here, '../../../../renderers/module-service/generation/__goldens__/javascript');
const readGolden = (name: string): string => readFileSync(join(goldenDir, name), 'utf8');

describe('generation engine — determinism enforcement', () => {
  it('emits the JS origin byte-identically across two runs', () => {
    const a = generateOrigin(javascriptBackend);
    const b = generateOrigin(javascriptBackend);
    expect(a.core.source).toBe(b.core.source);
    expect(a.shell.source).toBe(b.shell.source);
  });

  it('throws NonDeterministicBackendError when a backend is not a pure function of the IR', () => {
    let n = 0;
    const flaky: LanguageBackend = {
      id: 'flaky',
      emit: (ir) => ({
        backend: 'flaky',
        core: { filename: 'c.js', language: 'flaky', source: `// run ${(n += 1)}\n` },
        shell: { filename: 's.js', language: 'flaky', source: 'x' },
      }),
    };
    expect(() => generateOrigin(flaky, SERVE_PATH)).toThrow(NonDeterministicBackendError);
  });
});

describe('JS backend — golden drift gate', () => {
  const origin = generateOrigin(javascriptBackend);
  it('core matches the committed golden', () => {
    expect(origin.core.source).toBe(readGolden('origin.core.js'));
  });
  it('shell matches the committed golden', () => {
    expect(origin.shell.source).toBe(readGolden('origin.shell.js'));
  });
});

describe('JS backend — IR fidelity (generated core re-exposes the contract)', () => {
  it('the generated core constants deep-equal the IR', async () => {
    const { core } = generateOrigin(javascriptBackend);
    const mod = await import(
      /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(core.source)}`
    );
    expect(mod.VERSION).toBe(SERVE_PATH.version);
    expect(mod.BASE_PATH).toBe(SERVE_PATH.basePath);
    expect(mod.HASH_PIN_PATTERN).toBe(SERVE_PATH.hashPinPattern);
    expect(mod.CACHE_POLICY).toEqual(SERVE_PATH.cachePolicy);
    expect(mod.HEADERS).toEqual(SERVE_PATH.headers);
    expect(mod.PARAMS).toEqual(SERVE_PATH.params.map((p) => ({ ...p })));
    expect(mod.RESPONSES.map((r: { status: number }) => r.status)).toEqual(
      SERVE_PATH.responses.map((r) => r.status),
    );
    expect(mod.isHashPin('sha256-abc')).toBe(true);
    expect(mod.isHashPin('1.4.2')).toBe(false);
    expect(mod.isHashPin(null)).toBe(false);
  });
});

describe('JS backend — generated origin behaves (the #088 pin ladder)', () => {
  // Import the on-disk golden shell: its relative `import './origin.core.js'` resolves against the sibling
  // golden, so we exercise exactly the bytes the drift gate locks.
  const ID = 'sha256-deadbeef';
  const deps = {
    identity: async () => ({ id: ID, integrity: 'sha256-INTEGRITY' }),
    resolveDefinition: (name: string) => (name === 'card' ? '<card></card>' : null),
    transform: async () => ({ code: 'export const x = 1;', language: 'javascript', diagnostics: [] as string[] }),
    producer: 'test/1.2.3',
  };
  async function makeHandler() {
    const mod = await import(/* @vite-ignore */ join(goldenDir, 'origin.shell.js'));
    return mod.createGeneratedMaaSOrigin(deps);
  }

  it('404s a non-MaaS path', async () => {
    const handle = await makeHandler();
    const res = await handle(new Request('https://x/not-maas/card.js'));
    expect(res.status).toBe(404);
  });

  it('404s an unknown component', async () => {
    const handle = await makeHandler();
    const res = await handle(new Request('https://x/_maas/unknown.js'));
    expect(res.status).toBe(404);
  });

  it('302-redirects an unpinned (floating) request to the immutable hash URL', async () => {
    const handle = await makeHandler();
    const res = await handle(new Request('https://x/_maas/card.js?form=wc-class'));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`/_maas/card@${ID}.js?form=wc-class`);
    expect(res.headers.get('Cache-Control')).toBe(SERVE_PATH.cachePolicy.floating);
    expect(res.headers.get('X-MaaS-Producer')).toBe('test/1.2.3');
  });

  it('200-serves a matching content-hash pin, immutable + ETag + integrity', async () => {
    const handle = await makeHandler();
    const res = await handle(new Request(`https://x/_maas/card@${ID}.js`));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('export const x = 1;');
    expect(res.headers.get('Cache-Control')).toBe(SERVE_PATH.cachePolicy.immutable);
    expect(res.headers.get('ETag')).toBe(`"${ID}"`);
    expect(res.headers.get('X-MaaS-Integrity')).toBe('sha256-INTEGRITY');
  });

  it('404s a content-hash pin that does not match current state', async () => {
    const handle = await makeHandler();
    const res = await handle(new Request('https://x/_maas/card@sha256-stale.js'));
    expect(res.status).toBe(404);
  });

  it('304s a conditional request whose If-None-Match equals the current ETag', async () => {
    const handle = await makeHandler();
    const res = await handle(
      new Request(`https://x/_maas/card@${ID}.js`, { headers: { 'If-None-Match': `"${ID}"` } }),
    );
    expect(res.status).toBe(304);
  });
});
