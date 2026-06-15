/**
 * Reload-durable tier (#134) — in-harness-verifiable slice.
 *
 * The headline behaviour (work surviving a real reload via a service worker + Background
 * Fetch) is NOT exercised here — happy-dom ships neither. What IS verifiable, and what these
 * tests pin, is the standard-side contract: the `durability` config dimension, the
 * `withReloadDurability` trait, arm-time feature detection, the durability-derived
 * navigation-guard default, and the observable degrade-to-route-only re-arm (#450 rulings 2/3).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BackgroundTasksElement from '../../../background-task-surface/BackgroundTasksElement';
import { withReloadDurability } from '../../../background-task-surface/index';
import {
  isBackgroundFetchAvailable,
  registerDurableTransfer,
  rehydrateDurableTasks,
} from '../../../background-task-surface/reloadDurabilityAdapter';
import { MockLoaderHandle, registerTask } from '../../../background-task-surface/__fixtures__/mock-loader';

if (!customElements.get('background-tasks')) {
  customElements.define('background-tasks', BackgroundTasksElement);
}

function mount(): BackgroundTasksElement {
  const el = document.createElement('background-tasks') as BackgroundTasksElement;
  el.autoClearDelayMs = 0;
  document.body.appendChild(el);
  return el;
}

/** A fake Background Fetch manager + the registration that exposes it. */
function fakeRegistration(opts: { ids?: string[]; records?: Record<string, unknown> } = {}) {
  const fetch = vi.fn().mockResolvedValue({ id: 'x' });
  const getIds = vi.fn().mockResolvedValue(opts.ids ?? []);
  const get = vi.fn(async (id: string) => (opts.records ?? {})[id]);
  return { backgroundFetch: { fetch, getIds, get } } as unknown as ServiceWorkerRegistration & {
    backgroundFetch: { fetch: typeof fetch; getIds: typeof getIds; get: typeof get };
  };
}

/** Stub the globals so feature detection reports available. */
function stubBackgroundFetchAvailable() {
  vi.stubGlobal('navigator', { serviceWorker: {} });
  vi.stubGlobal('ServiceWorkerRegistration', function () {} as unknown);
  (globalThis.ServiceWorkerRegistration as unknown as { prototype: object }).prototype = {
    backgroundFetch: {},
  };
}

describe('reload-durable tier (#134)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('config dimension', () => {
    it('defaults to route-only', () => {
      const el = mount();
      expect(el.config.durability).toBe('route');
    });

    it('reads durability="reload" from the attribute', () => {
      const el = mount();
      el.setAttribute('durability', 'reload');
      expect(el.config.durability).toBe('reload');
    });

    it('only `route` and `reload` are honoured (no `resumable`)', () => {
      const el = mount();
      el.setAttribute('durability', 'resumable');
      expect(el.config.durability).toBe('route'); // unknown value falls back to baseline
    });
  });

  describe('withReloadDurability trait', () => {
    it('sets durability=reload and cleanup reverts to baseline', () => {
      const el = mount();
      const handle = withReloadDurability(el);
      expect(el.getAttribute('durability')).toBe('reload');
      expect(el.config.durability).toBe('reload');
      handle.cleanup();
      expect(el.hasAttribute('durability')).toBe(false);
    });
  });

  describe('feature detection (arm-time)', () => {
    it('false when no service worker / Background Fetch', () => {
      expect(isBackgroundFetchAvailable({ navigator: {} })).toBe(false);
    });

    it('true when both service worker and Background Fetch are present', () => {
      const scope = {
        navigator: { serviceWorker: {} },
        ServiceWorkerRegistration: Object.assign(function () {}, {
          prototype: { backgroundFetch: {} },
        }),
      };
      expect(isBackgroundFetchAvailable(scope)).toBe(true);
    });
  });

  describe('durability-derived guard + observable fallback (#450 rulings 2/3)', () => {
    it('degrades to route-only and re-arms the guard observably when Background Fetch is absent', () => {
      // happy-dom has no Background Fetch → unavailable.
      const el = mount();
      el.setAttribute('durability', 'reload');
      const handle = new MockLoaderHandle({ state: 'active', progress: 0.1 });
      registerTask(el, { id: 't1', label: 'Upload', progress: 'determinate', handle });
      // Fallback marker is set (observable) and the guard re-armed despite no explicit attr.
      expect(el.hasAttribute('data-durability-fallback')).toBe(true);
    });

    it('relaxes the guard by default when Background Fetch is available', () => {
      stubBackgroundFetchAvailable();
      const el = mount();
      el.setAttribute('durability', 'reload');
      const handle = new MockLoaderHandle({ state: 'active', progress: 0.1 });
      registerTask(el, { id: 't1', label: 'Upload', progress: 'determinate', handle });
      // Durable: no fallback marker, and no forced re-arm (author may still set navigation-guard).
      expect(el.hasAttribute('data-durability-fallback')).toBe(false);
    });
  });

  describe('adapter graceful degradation (never throws on unsupported)', () => {
    it('registerDurableTransfer reports unsupported rather than throwing', async () => {
      const res = await registerDurableTransfer({ id: 't1', label: 'Upload', requests: ['/f'] });
      expect(res.durable).toBe(false);
      expect(res.fallbackReason).toBe('unsupported');
    });

    it('rehydrateDurableTasks returns [] when unsupported', async () => {
      expect(await rehydrateDurableTasks()).toEqual([]);
    });

    it('registers a durable transfer when Background Fetch is available', async () => {
      stubBackgroundFetchAvailable();
      const reg = fakeRegistration();
      const res = await registerDurableTransfer(
        { id: 't1', label: 'Upload', requests: ['/file'], downloadTotal: 100 },
        async () => reg,
      );
      expect(res.durable).toBe(true);
      expect(reg.backgroundFetch.fetch).toHaveBeenCalledWith('t1', ['/file'], {
        title: 'Upload',
        downloadTotal: 100,
      });
    });

    it('rehydrates in-progress transfers into register details', async () => {
      stubBackgroundFetchAvailable();
      const reg = fakeRegistration({
        ids: ['t1'],
        records: { t1: { id: 't1', downloaded: 50, downloadTotal: 100, result: '' } },
      });
      const details = await rehydrateDurableTasks(async () => reg);
      expect(details).toHaveLength(1);
      expect(details[0]).toMatchObject({ id: 't1', progress: 'determinate' });
      expect(details[0].loaderState.getSnapshot()).toMatchObject({ state: 'active', progress: 0.5 });
    });
  });
});
