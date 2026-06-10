/**
 * Conformance suite for the Auto-Define registry + platform-config flavors (#242). Proves the
 * config-extends-platform default model: the tool carries NO default; flavors a project extends supply
 * it through the core `CustomRegistry` chain. Also covers the open-extension hook (custom strategies),
 * and the `lazy-dom` reference inferring strategy (DOM-presence MutationObserver) + `build-parsed`.
 *
 * Spec: /projects/webcomponents/#protocol-auto-define-strategy
 */
import { describe, it, expect } from 'vitest';
import CustomRegistry from '../../../../plugs/core/CustomRegistry';
import {
  CustomAutoDefineRegistry,
  UnknownAutoDefineError,
  createStrictExplicitFlavor,
  createLazyDomFlavor,
  createBuildParsedFlavor,
  AUTO_DEFINE_FLAVORS,
  explicitAutoDefine,
  lazyDomAutoDefine,
  createLazyDomAutoDefine,
  createDomPresenceObserver,
  conventionResolver,
  createBuildParsedAutoDefine,
  type AutoDefineStrategy,
} from '../../../renderers/auto-define';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('CustomAutoDefineRegistry — extends core CustomRegistry, no tool-baked default', () => {
  it('is a core CustomRegistry with the customAutoDefine localName', () => {
    const reg = new CustomAutoDefineRegistry();
    expect(reg).toBeInstanceOf(CustomRegistry);
    expect(reg.localName).toBe('customAutoDefine');
    expect(typeof reg.has).toBe('function');
    expect(typeof reg.keys).toBe('function');
  });

  it('a bare registry has NO default (the #243 distinction — no first-registered-wins)', () => {
    const reg = new CustomAutoDefineRegistry();
    reg.define(explicitAutoDefine); // registered WITHOUT asDefault
    expect(reg.has('explicit')).toBe(true);
    expect(reg.defaultKey).toBeNull(); // registration order must NOT seed a default
    expect(() => reg.resolve()).toThrow(UnknownAutoDefineError);
  });

  it('asDefault / setDefault are the only ways a default is set', () => {
    const reg = new CustomAutoDefineRegistry();
    reg.define(explicitAutoDefine, true);
    expect(reg.defaultKey).toBe('explicit');

    const reg2 = new CustomAutoDefineRegistry();
    reg2.define(explicitAutoDefine);
    reg2.define(lazyDomAutoDefine);
    expect(reg2.defaultKey).toBeNull();
    reg2.setDefault('lazy-dom');
    expect(reg2.defaultKey).toBe('lazy-dom');
    expect(() => reg2.setDefault('nope')).toThrow(UnknownAutoDefineError);
  });

  it('resolve(key) returns the named strategy; an unknown name throws', () => {
    const reg = createLazyDomFlavor();
    expect(reg.resolve('explicit').key).toBe('explicit');
    expect(reg.resolve('lazy-dom').key).toBe('lazy-dom');
    expect(() => reg.resolve('nope')).toThrow(UnknownAutoDefineError);
  });
});

describe('Platform-config flavors — the default lives in the config a project extends', () => {
  it('each shipped flavor registers its strategies and declares its own default', () => {
    expect(createStrictExplicitFlavor().defaultKey).toBe('explicit');
    expect(createLazyDomFlavor().defaultKey).toBe('lazy-dom');
    expect(createBuildParsedFlavor().defaultKey).toBe('build-parsed');
    // lazy-dom / build-parsed flavors still carry explicit alongside their default.
    expect(createLazyDomFlavor().has('explicit')).toBe(true);
  });

  it('AUTO_DEFINE_FLAVORS exposes the three named flavors for discovery', () => {
    expect(Object.keys(AUTO_DEFINE_FLAVORS).sort()).toEqual(['build-parsed', 'lazy-dom', 'strict-explicit']);
  });

  it('a project sets its default by EXTENDING a flavor (inherits strategies + default)', () => {
    const project = new CustomAutoDefineRegistry({ extends: [createLazyDomFlavor()] });
    expect(project.has('lazy-dom')).toBe(true); // strategy table inherited via core CustomRegistry
    expect(project.has('explicit')).toBe(true);
    expect(project.defaultKey).toBe('lazy-dom'); // default inherited through the same chain
    expect(project.resolve().key).toBe('lazy-dom');
  });

  it('per-scope override: a child registry overrides the inherited default without touching the parent', () => {
    const platform = createLazyDomFlavor();
    const scope = new CustomAutoDefineRegistry({ extends: [platform] });
    scope.setDefault('explicit'); // this subtree prefers eager registration
    expect(scope.defaultKey).toBe('explicit');
    expect(scope.resolve().key).toBe('explicit');
    // the extended platform config is untouched (nearest-config-wins, not mutation)
    expect(platform.defaultKey).toBe('lazy-dom');
  });
});

describe('Open extension — a custom strategy coexists conflict-free', () => {
  it('a custom AutoDefineStrategy registers and resolves like the shipped ones (no forking)', () => {
    const serverDriven: AutoDefineStrategy = {
      key: 'server-driven',
      trigger: 'server-render',
      resolve: (tag) => ({ specifier: `/ssr/${tag}` }),
      define: () => {},
    };
    const project = new CustomAutoDefineRegistry({ extends: [createLazyDomFlavor()] });
    project.define(serverDriven);
    // Custom + shipped both resolvable from the one chain — conflict-free coexistence.
    expect(project.resolve('server-driven')).toBe(serverDriven);
    expect(project.resolve('lazy-dom').key).toBe('lazy-dom');
    expect(project.resolve('explicit').key).toBe('explicit');
    // A project can even make the custom one its default by extension.
    project.setDefault('server-driven');
    expect(project.resolve().key).toBe('server-driven');
  });
});

describe('lazy-dom — the reference inferring strategy (DOM presence)', () => {
  it('exposes the inferring contract: key, first-use trigger, and a resolve', () => {
    expect(lazyDomAutoDefine.key).toBe('lazy-dom');
    expect(lazyDomAutoDefine.trigger).toBe('first-use');
    expect(typeof lazyDomAutoDefine.resolve).toBe('function');
  });

  it('the convention resolver maps a tag to its sibling module', () => {
    expect(conventionResolver('foo-bar')).toEqual({ specifier: './foo-bar.js' });
    expect(lazyDomAutoDefine.resolve?.('my-widget')).toEqual({ specifier: './my-widget.js' });
  });

  it('imports the defining module for an undefined custom element already in the DOM', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<lazy-present></lazy-present>';
    document.body.appendChild(root);
    const imported: string[] = [];
    const importer = async (specifier: string) => {
      imported.push(specifier);
    };
    const disconnect = createDomPresenceObserver(lazyDomAutoDefine, root, { import: importer });
    await tick();
    expect(imported).toEqual(['./lazy-present.js']);
    disconnect();
    root.remove();
  });

  it('imports the module for an element ADDED after the observer starts (MutationObserver path)', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const imported: string[] = [];
    const disconnect = createDomPresenceObserver(lazyDomAutoDefine, root, {
      import: async (s) => {
        imported.push(s);
      },
    });
    root.appendChild(document.createElement('lazy-added'));
    await tick();
    expect(imported).toContain('./lazy-added.js');
    disconnect();
    root.remove();
  });

  it('a non-inferring strategy (explicit) yields a no-op observer', () => {
    const root = document.createElement('div');
    const disconnect = createDomPresenceObserver(explicitAutoDefine, root);
    expect(typeof disconnect).toBe('function');
    expect(() => disconnect()).not.toThrow();
  });

  it('a custom resolver overrides the convention', () => {
    const strat = createLazyDomAutoDefine({ resolve: (tag) => ({ specifier: `@components/${tag}` }) });
    expect(strat.resolve?.('x-y')).toEqual({ specifier: '@components/x-y' });
  });
});

describe('build-parsed — manifest-backed build-time resolution', () => {
  it('resolves a tag against the build manifest; an unknown tag returns undefined', () => {
    const strat = createBuildParsedAutoDefine({ 'x-known': '/dist/x-known.js' });
    expect(strat.key).toBe('build-parsed');
    expect(strat.trigger).toBe('build-time');
    expect(strat.resolve?.('x-known')).toEqual({ specifier: '/dist/x-known.js' });
    expect(strat.resolve?.('x-missing')).toBeUndefined();
  });
});
